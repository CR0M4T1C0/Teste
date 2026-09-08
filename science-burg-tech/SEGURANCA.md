# Segurança do Burger Tech

Documento das decisões de segurança do sistema: o que está protegido, como,
e o que ficou conscientemente de fora (com o motivo). Serve tanto como
referência para quem mexe no código quanto para defender as escolhas numa
apresentação.

---

## 1. Senhas

Senhas nunca são guardadas em texto puro. O banco só armazena o **hash
bcrypt** (`passlib`), que é um algoritmo propositalmente lento: mesmo que o
arquivo do banco vaze, testar senhas uma a uma fica caro demais para
compensar.

O primeiro administrador é criado pelo script `python -m app.criar_admin`,
que gera o hash na hora. **Não existe** administrador de exemplo no
`schema.sql` de propósito — um hash fixo escrito no repositório seria uma
senha pública.

## 2. Dois logins separados, dois segredos separados

Clientes ficam na tabela `usuarios`; a equipe da loja, em `administradores`.
São dois fluxos de login distintos, e cada um assina os seus tokens com um
**segredo diferente** (`JWT_SECRET_CLIENTE` e `JWT_SECRET_ADMIN`).

Há duas barreiras independentes impedindo que um cliente acesse o painel:

1. a claim `tipo_conta` dentro do token, conferida em toda rota; e
2. o segredo diferente — um token de cliente nem sequer passa na verificação
   de assinatura de uma rota de admin.

O `config.py` **recusa subir a API** se os dois segredos forem iguais, porque
isso derrubaria silenciosamente a segunda barreira.

## 3. Segredos de configuração

Os segredos vêm do arquivo `.env`, que **não é versionado** (veja o
`.gitignore`). Só o `.env.example` vai para o repositório, sem valores reais.

O comportamento muda conforme a variável `AMBIENTE`:

| Situação | `AMBIENTE=desenvolvimento` | `AMBIENTE=producao` |
|---|---|---|
| Segredo ausente | gera um aleatório na memória e avisa | **recusa subir** |
| Segredo de exemplo ou com menos de 32 caracteres | idem | **recusa subir** |
| Os dois segredos iguais | recusa subir | recusa subir |
| `CORS_ORIGINS=*` | permitido | **recusa subir** |

O motivo de falhar alto em produção: antes, uma API sem `.env` subia
normalmente usando um segredo fixo escrito no código-fonte. Qualquer pessoa
com acesso ao repositório conseguiria assinar um token de administrador
válido — e nada no comportamento do sistema denunciaria o problema.

## 4. Proteção contra força bruta

As telas de login (cliente e admin) contam tentativas erradas por **IP +
e-mail**: cinco falhas dentro de 15 minutos bloqueiam aquela combinação por
15 minutos, respondendo `HTTP 429` com o header `Retry-After`.

A chave combina IP e e-mail de propósito: assim, errar a própria senha não
bloqueia o e-mail de outra pessoa a partir de outro lugar, e um atacante num
IP só não consegue varrer vários e-mails sem ser barrado.

O **registo** também é limitado, mas por **IP apenas** (não faz sentido
combinar com e-mail — cada tentativa costuma usar um e-mail diferente): cinco
tentativas de registar um e-mail que já existe, vindas do mesmo IP dentro de
15 minutos, bloqueiam esse IP. Ver seção 5 para o porquê.

> **Limitação conhecida:** a contagem vive na memória do processo
> (`app/limite_tentativas.py`). É suficiente para esta API, que roda num
> processo único. Se um dia o sistema for para vários *workers* ou várias
> máquinas, cada um teria o seu próprio contador — nesse cenário isto
> precisa migrar para um armazenamento compartilhado (Redis, por exemplo).
>
> Dentro de um processo único, o dicionário em memória **não** cresce sem
> limite: uma varredura periódica (a cada 5 minutos, no máximo) remove as
> chaves que já não têm tentativa recente nem bloqueio ativo. Sem isso, um
> ataque de enumeração usando um e-mail diferente a cada tentativa (cada um
> vira uma chave nova, nunca mais consultada) faria o dicionário crescer pra
> sempre enquanto a API ficasse no ar.

## 5. Enumeração de usuários

**No login**, quando o e-mail digitado não existe, a API roda **mesmo
assim** uma verificação bcrypt contra um hash descartável
(`gastar_tempo_de_verificacao()`), e devolve exatamente a mesma mensagem de
"E-mail ou senha incorretos". Sem isso, um e-mail inexistente respondia
instantaneamente e um e-mail real com senha errada demorava o tempo do
bcrypt — essa diferença de tempo permite descobrir quem tem conta no site.

**No registo**, essa proteção não é possível da mesma forma: a resposta
*precisa* dizer "esse e-mail já existe" para o usuário saber que deve entrar
em vez de tentar se cadastrar de novo — esconder isso de verdade exigiria um
fluxo de confirmação por e-mail (criar a conta "pendente" e só ativá-la
depois de um clique no e-mail), fora do escopo deste projeto acadêmico. A
mitigação aceita foi o limite de tentativas por IP da seção 4: não impede
descobrir se **um** e-mail específico já tem conta, mas impede varrer uma
lista inteira de e-mails rapidamente.

## 6. Preços

O preço de um item **nunca** vem do navegador. Ao montar um pedido
(`routers/pedidos.py`), a API busca o produto no banco e usa o preço de lá,
ignorando qualquer valor enviado pelo cliente. Também confere se o produto
existe e está com `disponivel = 1`.

O preço de cada item fica *copiado* na tabela `itens_pedido`
(`preco_unitario`), e não apenas referenciado: assim, mudar o preço no
cardápio amanhã não reescreve o histórico do que já foi vendido hoje.

## 7. Upload de imagens

O endpoint `POST /api/admin/upload-imagem` é restrito ao papel `admin` e
aplica quatro checagens:

1. **Tipo declarado** precisa ser JPEG, PNG, WebP ou GIF.
2. **Conteúdo real** é conferido pelos *magic bytes* do arquivo. O
   `content-type` é informado pelo cliente, ou seja, dá para mentir — sem
   essa checagem, um HTML com `<script>` poderia ser gravado como `.png`
   numa pasta servida publicamente.
3. **Tamanho** limitado a 5 MB, lendo 1 byte a mais que o limite em vez de
   montar o `bytes` inteiro na mão para só então medir (o Starlette já
   recebe e guarda o upload num arquivo temporário antes do endpoint rodar —
   isso não evita o disco ser usado por um upload grande, só evita uma cópia
   extra do conteúdo na memória do próprio endpoint).
4. **Nome do arquivo** é gerado pelo servidor com
   `secrets.token_urlsafe(12)` + extensão da lista permitida. O nome enviado
   pelo usuário é descartado, o que elimina de uma vez *path traversal*
   (`../../`) e sobrescrita de arquivos existentes.

## 8. Mesas e QR codes

Cada mesa tem um `qr_token` aleatório longo. Os tokens que aparecem no
`schema.sql` são previsíveis de propósito (`mesa-01-a1b2c3`), e por isso a
API **os troca por valores aleatórios** na primeira vez que cria o banco
(`_rotacionar_qr_tokens_do_seed`). Sem isso, alguém poderia adivinhar o link
de uma mesa que não é a sua e lançar pedidos na comanda alheia.

O banco (PostgreSQL, hospedado no Neon) nunca é versionado — a connection
string em `apps/api/.env` (que contém a senha de acesso) está no
`.gitignore`, e versionar o schema não expõe dados: `schema.sql` só cria a
estrutura e o seed de cardápio/mesas, sem hashes de senha nem dados de
clientes.

## 9. Banco de dados

- Todas as consultas usam **parâmetros** (`%s`, o placeholder do psycopg),
  nunca concatenação de string. Não há caminho para SQL injection.
- No único ponto em que o SQL é montado dinamicamente (o `PATCH` de
  produto), os nomes de coluna passam por uma **lista branca**
  (`COLUNAS_PRODUTO_EDITAVEIS`) antes de entrar na string SQL — os valores
  continuam sempre parametrizados. Hoje isso não é uma vulnerabilidade
  alcançável de fora (o Pydantic já descarta qualquer campo desconhecido do
  JSON antes desse código rodar), é defesa em profundidade: garante que um
  campo novo adicionado ao schema com nome diferente da coluna real falhe
  alto, em vez de gerar SQL quebrado silenciosamente em produção.
- Chaves estrangeiras são sempre aplicadas pelo PostgreSQL — diferente do
  SQLite (usado antes da migração), não existe um interruptor pra
  desligá-las; um pedido apontando para um produto inexistente é rejeitado
  pelo próprio banco.
- Regras de negócio críticas (liberar a mesa quando a comanda é paga, manter
  `atualizado_em`) ficam em **triggers**, dentro do banco, e não dependem de
  o backend lembrar de executá-las.

## 10. CORS

As origens permitidas são declaradas explicitamente em `CORS_ORIGINS`. Como
a API usa `allow_credentials=True`, o valor `*` seria perigoso — permitiria
que qualquer site chamasse a API aproveitando a sessão do usuário logado.
Por isso `*` é bloqueado quando `AMBIENTE=producao`.

---

## Limitações conhecidas (decisões conscientes)

### Tokens no `localStorage`

Os tokens ficam no `localStorage` do navegador. Isso os deixa expostos a
**XSS**: um script malicioso injetado na página conseguiria lê-los.

A alternativa correta seria um cookie `httpOnly`, que o JavaScript não
consegue ler. Não foi adotada porque exigiria também implementar proteção
contra **CSRF** (que o cookie reintroduz) e mudar a forma como o WebSocket
do painel autentica. O risco foi aceito considerando que:

- o front-end não renderiza HTML vindo do usuário (o React escapa tudo por
  padrão), o que fecha o vetor de XSS mais comum;
- as sessões expiram (8 h para admin, 24 h para cliente) e agora **expiram
  de verdade**: o front desloga sozinho no vencimento, em vez de manter uma
  tela aparentemente logada.

É o principal ponto a evoluir se o sistema for para produção real.

### Sem revogação de token

A tabela `sessoes_administrador` existe no schema justamente para permitir
"deslogar de todos os lugares" e revogar acesso na hora, mas o backend ainda
não a usa: hoje um token vale até vencer. Desativar um administrador
(`ativo = 0`) **funciona imediatamente**, porque o `ativo` é conferido no
banco a cada requisição — mas revogar um token específico ainda não.

### Token do WebSocket na URL

O `/ws/admin` recebe o token por *query param*, porque o WebSocket nativo do
navegador não permite enviar header `Authorization`. Query params tendem a
aparecer em logs de servidor. Em produção o caminho seria emitir um *ticket*
de uso único e curta duração só para abrir a conexão.

### Enumeração de e-mail pelo registo (mitigada, não eliminada)

Como explicado na seção 5, `POST /api/auth/registo` continua respondendo
diferente para um e-mail que já existe — é necessário para a experiência de
uso. O limite de tentativas por IP torna uma varredura em massa lenta e
detectável, mas não impede descobrir se um e-mail específico e já conhecido
tem conta.

### Pagamento é simulado

Fechar uma comanda grava uma linha em `pagamentos` com status `aprovado`.
Não há integração com nenhuma operadora — é um sistema acadêmico. Uma
integração real traria PCI-DSS, *webhooks* de confirmação e tratamento de
estorno.

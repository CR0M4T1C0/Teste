# Banco de dados — burger-tech

Este documento explica a estrutura do arquivo `schema.sql` (PostgreSQL, hospedado no [Neon](https://neon.tech)): o que cada tabela representa, o que cada coluna faz, e como funciona o sistema de mesas. Nada disso está ligado ao front-end React ainda — é só o banco.

## Por que PostgreSQL (via Neon)

O projeto começou em SQLite (um arquivo local, sem servidor) e migrou para PostgreSQL quando o time precisou de um banco compartilhado entre várias pessoas e ambientes (cada um rodando a API na própria máquina, todos apontando pro mesmo banco). O Neon hospeda o Postgres de graça e oferece "branches" do banco (como branches de git) — o projeto usa uma branch para desenvolvimento e outra, isolada, só para os testes automatizados. Os IDs continuam números inteiros que crescem sozinhos (`GENERATED ALWAYS AS IDENTITY`, o equivalente em Postgres ao `AUTOINCREMENT` do SQLite) — mais simples que UUID e sem exigir gerador de UUID. Diferente do SQLite, o Postgres sempre aplica chaves estrangeiras; não existe um interruptor equivalente ao `PRAGMA foreign_keys` para esquecer de ligar.

## Visão geral das tabelas

O banco tem duas "famílias" de tabelas: uma para pedidos online (entrega/retirada) e uma para atendimento presencial (mesas). As duas se encontram na tabela `pedidos`, que serve os dois casos.

### usuarios

Só clientes — quem compra. É onde o Login e o Registo do front-end **público** vão gravar e consultar.

| coluna | o que é |
|---|---|
| `id` | identificador único, gerado sozinho |
| `nome`, `email`, `telefone` | dados de cadastro; `email` é único, não dá pra repetir |
| `senha_hash` | nunca a senha em si — só o hash dela (ex.: gerado com bcrypt/passlib no backend) |
| `criado_em` / `atualizado_em` | preenchidos e atualizados sozinhos pelo banco |

### administradores e sessoes_administrador — login de administração

Adicionei essas duas depois de conversarmos sobre o painel de admin. A equipe da loja (quem vê os pedidos de todas as mesas + delivery) **não fica na mesma tabela dos clientes** — é um login completamente separado, para uma tela completamente separada. Isso evita, por exemplo, que um bug num endpoint pensado pra cliente acabe expondo dado de funcionário sem querer.

| coluna (`administradores`) | o que é |
|---|---|
| `nome`, `email`, `senha_hash` | dados de login da equipe |
| `papel` | `admin` (acesso total: pedidos, cardápio, mesas, equipe) ou `atendente` (opera o salão no dia a dia — abre mesa, lança pedido, fecha conta) |
| `ativo` | desativar o acesso de alguém que saiu da equipe, sem apagar o histórico do que essa pessoa atendeu |

`sessoes_administrador` guarda os tokens de login ativos da equipe (`token_hash`, `expira_em`, `revogado_em`). Isso é o que permite, na prática, "derrubar" o acesso de alguém na hora (ex.: funcionário demitido) — coisa que um token JWT sozinho, sem nenhum registro no banco, não deixaria fazer.

Note que eu **não** coloquei um administrador de exemplo no seed com senha fixa — isso deixaria uma senha "de mentira" só um hash fixo público no repositório, o que é um problema de segurança real. O primeiro admin deve ser criado por um script do próprio backend, que gera o hash de verdade na hora.

### enderecos

Endereços de entrega de um cliente. Um cliente pode ter vários; `padrao` marca qual usar por padrão no checkout.

### categorias e produtos

`categorias` é a lista fixa (hambúrguer, acompanhamento, bebida, sobremesa) que hoje está no array `CATS` do `menu.tsx`. `produtos` é cada item do cardápio — corresponde ao tipo `Item` do `types.ts`. O campo `disponivel` permite "pausar" um produto (esgotado, fora de temporada) sem apagar o histórico de quem já comprou ele.

## O sistema de mesas

Essa é a parte nova. Pensei nela em cima de como um restaurante físico realmente funciona, não só como "adicionar uma coluna mesa no pedido" — porque um cliente sentado numa mesa normalmente não faz um pedido só: ele pede o lanche, depois mais uma bebida, depois a sobremesa, e só fecha a conta quando vai embora. Se cada pedido fosse solto e independente, ficaria difícil somar tudo o que aquela mesa consumiu na visita e fechar a conta de uma vez.

Por isso são duas tabelas, não uma:

### mesas

A mesa física em si — permanente, não muda com o tempo.

| coluna | o que é |
|---|---|
| `numero` | o número impresso na mesa ("Mesa 7") |
| `capacidade` | quantas pessoas sentam |
| `status` | `livre`, `ocupada`, `reservada` ou `inativa` (mesa quebrada/fora de uso) |
| `qr_token` | um código único por mesa, pensado para gerar um QR code que o cliente escaneia e cai direto no cardápio já identificando a mesa — sem precisar digitar o número |

> Os `qr_token` do seed (`mesa-01-a1b2c3` etc.) são só exemplo, previsíveis de propósito para dar pra testar. A própria API troca cada um por um token aleatório longo (`secrets.token_urlsafe(24)`) assim que cria as tabelas pela primeira vez num banco novo (`_rotacionar_qr_tokens_do_seed`, em `app/db.py`) — é isso que impede alguém de "adivinhar" o link de uma mesa que não é a dela.

### comandas

Representa **uma visita** — do momento em que a mesa é ocupada até a conta ser fechada e paga. Cada "rodada" de pedido feita durante essa visita é uma linha em `pedidos` apontando pra essa comanda (`pedidos.comanda_id`).

| coluna | o que é |
|---|---|
| `mesa_id` | qual mesa está sendo usada |
| `usuario_id` | o cliente responsável, se ele estiver logado (pode ficar em branco — nem todo mundo vai logar só para comer no salão) |
| `aberta_por` | qual atendente (da tabela `administradores`) abriu/está responsável pela mesa nessa visita — opcional, útil pro painel mostrar "quem está atendendo a mesa 5" |
| `numero_pessoas` | quantas pessoas estão na mesa nessa visita |
| `status` | `aberta` → `fechada` ou `paga` (ou `cancelada`) |
| `aberta_em` / `fechada_em` | quando a visita começou e terminou |

**As duas regras de negócio mais importantes ficam garantidas pelo próprio banco, não dependem do código do backend lembrar de checar:**

1. Uma mesa não pode ter duas comandas abertas ao mesmo tempo — isso é um índice único que só considera comandas com `status = 'aberta'`.
2. A mesa muda de status sozinha: um *trigger* marca a mesa como `ocupada` assim que uma comanda é aberta nela, e outro *trigger* marca como `livre` assim que a comanda é fechada, paga ou cancelada. Testei os dois cenários rodando o schema de verdade e funcionou: abrir a comanda ocupa a mesa, tentar abrir uma segunda na mesma mesa dá erro, e pagar a comanda libera a mesa de novo.

### Como isso aparece em `pedidos`

A tabela `pedidos` agora serve três situações, todas com uma regra de consistência garantida por um `CHECK`:

- **`tipo = 'entrega'`** → precisa de `endereco_id`, não pode ter `comanda_id`.
- **`tipo = 'retirada'`** → não usa nem endereço nem comanda (cliente busca no balcão).
- **`tipo = 'local'`** → precisa de `comanda_id` (a mesa), não pode ter `endereco_id`.

Se o código do backend tentar salvar, por exemplo, um pedido `local` com um `endereco_id` preenchido, o banco recusa sozinho — testei isso também.

### Como isso aparece em `pagamentos`

Pensei em duas formas de pagar: fechar **um pedido** específico (o normal em entrega/retirada — paga na hora que o pedido é feito) ou fechar **a comanda inteira** (o normal numa mesa — paga tudo o que a mesa consumiu na visita, de uma vez, no final). Por isso `pagamentos` tem tanto `pedido_id` quanto `comanda_id`, mas um `CHECK` garante que só um dos dois é preenchido por vez, nunca os dois juntos e nunca nenhum.

## Coisas que ainda não estão aqui de propósito (para você decidir)

Não implementei porque acho que são decisões suas, não técnicas:

- **Divisão de conta por pessoa.** Hoje a comanda fecha com um pagamento só. Se vocês quiserem permitir "cada um paga a sua parte", dá pra adicionar uma tabela `divisoes_pagamento` ligando pagamentos a pessoas específicas da mesa — mas isso é bem mais complexo e só vale a pena implementar se for algo que vocês realmente vão oferecer.
- **Reservas de mesa com antecedência** (marcar mesa pra daqui a 2 horas). Se fizer sentido pro negócio, é uma tabela nova (`reservas`: mesa, cliente, data/hora, número de pessoas, status) que muda o status da mesa para `reservada` até a hora chegar.
- **Chamar garçom pelo QR code.** Dá pra reaproveitar o `qr_token` da mesa pra isso, mas é mais uma feature de aplicação (WebSocket/notificação) do que de banco de dados.

Se quiser, posso desenhar qualquer uma dessas três também — me diga qual faz mais sentido pra como vocês pretendem operar (é só delivery com um salão físico do lado, é majoritariamente presencial, vai ter garçom com tablet, etc.) que eu ajusto o desenho certo.

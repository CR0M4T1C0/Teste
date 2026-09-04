# Como explicar o Burger Tech pros seus amigos

Um guia para você mandar pra quem vai rodar o projeto — com o "tradutor" do
jargão técnico e o passo a passo de verdade.

## Primeiro, o resumo que dá pra falar de boca

Se alguém perguntar "o que é esse projeto", a explicação simples é:

> "É um sistema pra hamburgueria: um site pra pedir delivery, um QR code na
> mesa pra pedir sem garçom, e um painel pra quem trabalha na loja acompanhar
> os pedidos em tempo real. Tem duas partes: uma parte visual (o que o
> cliente vê no navegador) e uma parte que guarda os dados e as regras
> (pedido, pagamento, mesa ocupada etc.)."

## O "tradutor" do jargão

| Termo | O que é, em bom português |
|---|---|
| **React** | A ferramenta que monta a parte visual do site (botões, telas, carrinho). É só JavaScript organizado em pedacinhos reutilizáveis — não é um site "pronto", é a peça que constrói as telas. |
| **Vite** | O programa que roda o React na sua máquina enquanto você desenvolve, e que depois "empacota" tudo pra colocar no ar. Pensa nele como o motor por trás do React. |
| **TypeScript** | JavaScript com um corretor automático a mais — avisa erro antes de rodar o código. |
| **FastAPI** | A ferramenta em Python que faz a "parte de trás": recebe os pedidos, confere login, fala com o banco de dados. É o que o React conversa por trás das cortinas. |
| **PostgreSQL** | O banco de dados de verdade que guarda tudo (pedidos, usuários, mesas). Em vez de instalar um programa no PC, o projeto usa o **Neon**, que hospeda o banco de graça na nuvem. |
| **Neon** | O serviço (gratuito) que hospeda o PostgreSQL do projeto. Você cria uma conta, cria um projeto, e cola o "endereço" do banco (a connection string) no `.env`. |
| **Node.js** | O programa que precisa estar instalado no PC pra rodar o React/Vite. Sem ele, a parte visual não liga. |
| **Python** | O programa que precisa estar instalado pra rodar o back-end (FastAPI). |
| **.env** | Um arquivo de configuração com senhas/segredos do projeto. Cada pessoa cria o seu localmente — nunca é o mesmo pra todo mundo, e nunca deve ser compartilhado publicamente. |
| **API** | O "portão" por onde o React pede informação pro Python (ex.: "me dá o cardápio", "salva esse pedido"). |
| **Build** | "Empacotar" o site pra publicar: junta e comprime tudo num punhado de arquivos que qualquer servidor consegue servir. É o `npm run build`. |

A ideia central pra passar pros amigos: **são dois programas rodando ao
mesmo tempo, em duas janelas de terminal diferentes** — um cuida da tela
(React), o outro cuida dos dados (Python). Um não funciona sem o outro
rodando junto.

## O que precisa instalar antes (uma vez só, por pessoa)

1. **Node.js** (versão 18 ou mais nova) — [nodejs.org](https://nodejs.org),
   baixa o instalador e clica em "next" até terminar.
2. **Python** (versão 3.11 ou mais nova) — [python.org](https://python.org).
   No instalador do Windows, é importante marcar a caixinha **"Add python.exe
   to PATH"** antes de instalar, senão os comandos não funcionam depois.
3. Um editor de código, se quiser mexer — [VS Code](https://code.visualstudio.com)
   é o mais comum.
4. Uma conta gratuita no [Neon](https://neon.tech) — é o banco de dados do
   projeto, na nuvem (não precisa instalar nada no PC pra isso).

## Passo a passo pra colocar pra funcionar

### Passo 0 — criar o banco de dados no Neon

Crie uma conta em [neon.tech](https://neon.tech) e um projeto novo (pode
escolher qualquer nome e região). O projeto já vem com uma branch pronta —
essa é o seu banco de desenvolvimento. Se for rodar os testes automatizados,
crie mais uma branch (ex.: `test`) exclusiva pra isso. No painel do projeto,
clique em "Connect" em cada branch e copie a connection string — você vai
usar no passo seguinte.

Depois de descompactar o zip, abrir **dois terminais** (dois separados,
ambos dentro da pasta `burger-tech`) e deixar os dois rodando ao mesmo
tempo.

### Terminal 1 — o back-end (Python)

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate          # no Windows. No Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # no Windows. No Mac/Linux: cp .env.example .env
```

Abra o `.env` que acabou de ser criado e cole as connection strings do Neon
em `DATABASE_URL` (e `DATABASE_URL_TESTE`, se for rodar os testes). Só
depois disso, suba a API:

```bash
uvicorn app.main:app --reload
```

Na primeira vez que sobe, ele aplica sozinho o `schema.sql` no banco do Neon
e mostra no terminal os links de cada mesa (pra gerar QR code depois). Deixa
esse terminal aberto — ele fica escutando em `http://127.0.0.1:8000`.

Se for usar o painel administrativo, crie o primeiro login de admin (uma
vez só, com o back-end já rodando):

```bash
python -m app.criar_admin
```

### Terminal 2 — o front-end (React)

Num terminal novo, a partir da pasta raiz do projeto (`burger-tech`, não
`apps/api`):

```bash
npm install
npm run dev
```

Isso abre em `http://localhost:5173` — é o endereço que se acessa no
navegador. O Vite já está configurado pra conversar sozinho com o Python
rodando no outro terminal, então ninguém precisa mexer em nada de conexão.

### Testando se deu certo

- Abre `http://localhost:5173` no navegador → deve aparecer o site.
- Abre `http://127.0.0.1:8000/docs` → deve aparecer a documentação da API
  (se aparecer, o back-end está de pé).

## Erros comuns (e o que costuma resolver)

- **"python não é reconhecido como comando"** → o Python foi instalado sem
  marcar a opção de adicionar ao PATH; reinstalar marcando a caixinha
  resolve.
- **"npm não é reconhecido"** → o Node.js não terminou de instalar ou o
  terminal foi aberto antes da instalação; fechar e abrir o terminal de
  novo costuma resolver.
- **Site abre mas fica dando erro pra carregar o cardápio** → o terminal do
  back-end (Terminal 1) não está rodando, ou fechou sozinho. Os dois
  terminais precisam ficar abertos ao mesmo tempo.
- **Esqueceu de copiar o `.env`** → a API sobe assim mesmo, gerando uma
  chave aleatória temporária, e avisa no terminal. Funciona pra testar; o
  único efeito é que todo mundo é deslogado sempre que a API reinicia.
- **"Muitas tentativas de login" mesmo digitando certo** → é a proteção
  contra força bruta (veja `SEGURANCA.md`): errou a senha demais vezes
  seguidas e a conta ficou bloqueada por alguns minutos. É intencional,
  passa sozinho.

## Se for só mostrar, sem instalar nada

Se o amigo só quer *ver* o projeto sem mexer em código, pode ser mais fácil
gravar um vídeo curto da tela rodando localmente, ou tirar prints das telas
principais, em vez de pedir pra instalar tudo isso.

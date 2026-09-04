# Burger Tech

Sistema completo do Science Burger Tech: site público de delivery, fluxo de
pedido por mesa (QR code) e painel administrativo — com um back-end próprio
em Python.

```
burger-tech/
├── apps/
│   ├── web/   ← front-end (React 18 + Vite + TypeScript + Tailwind v4)
│   └── api/   ← back-end (Python + FastAPI + PostgreSQL, hospedado no Neon)
├── SEGURANCA.md        ← decisões de segurança e limitações conhecidas
└── guia-para-amigos.md ← passo a passo em linguagem simples
```

Veja [apps/api/database/README.md](apps/api/database/README.md) para entender
o desenho do banco de dados (o mais importante é o sistema de mesas/comandas)
e [SEGURANCA.md](SEGURANCA.md) para as decisões de segurança.

## Rodando em desenvolvimento

Precisa de **Node.js** (18+), **Python** (3.11+) e uma conta gratuita no
[Neon](https://neon.tech) (PostgreSQL sem instalar nada localmente). Os dois
serviços (API e front-end) rodam em paralelo, em dois terminais separados.

### 0. Banco de dados (Neon)

Crie um projeto no [Neon](https://neon.tech). Um projeto novo já vem com uma
branch padrão — é ela que serve de banco de desenvolvimento. Crie **uma
segunda branch**, chamada por exemplo `test`, exclusiva para a suíte de
testes automatizados (assim `pytest` nunca escreve por cima dos dados que
você está usando pra desenvolver). Copie a connection string "pooled" de
cada branch (Dashboard do projeto → Connect) — você vai usá-las no `.env` no
próximo passo.

### 1. Back-end (API)

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate          # Windows (no Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # Windows (no Linux/Mac: cp .env.example .env)
```

Edite o `.env` recém-criado e cole as duas connection strings do Neon em
`DATABASE_URL` (branch de desenvolvimento) e `DATABASE_URL_TESTE` (branch de
testes). Depois:

```bash
uvicorn app.main:app --reload
```

Na primeira vez que sobe, a API aplica sozinha o `database/schema.sql` (13
tabelas + seed de categorias/produtos/mesas) na branch de desenvolvimento e
imprime no terminal os links `/m/<token>` de cada mesa (os QR codes apontam
pra essas URLs, no front-end). A API fica em `http://127.0.0.1:8000` — a
documentação interativa está em `http://127.0.0.1:8000/docs`.

Crie o primeiro administrador do painel (uma vez só):

```bash
python -m app.criar_admin
```

### 2. Front-end (web)

Num segundo terminal, a partir da raiz do repositório:

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. O Vite já está configurado para
redirecionar `/api/*`, `/ws/*` e `/uploads/*` para `http://127.0.0.1:8000`
(veja `apps/web/vite.config.ts`), então não precisa mexer em CORS nem em
URLs durante o desenvolvimento.

## Configuração (`.env`)

Todos os segredos ficam em `apps/api/.env`, criado a partir do
`.env.example`. As variáveis importantes:

| Variável | Para que serve |
|---|---|
| `AMBIENTE` | `desenvolvimento` ou `producao`. Em produção, a API se recusa a subir com segredos fracos ou CORS aberto. |
| `JWT_SECRET_CLIENTE` / `JWT_SECRET_ADMIN` | Assinam os tokens de login. Precisam ter 32+ caracteres e ser **diferentes entre si**. |
| `CORS_ORIGINS` | Domínios autorizados a chamar a API. |
| `DATABASE_URL` | Connection string do PostgreSQL (Neon), branch de desenvolvimento. |
| `DATABASE_URL_TESTE` | Connection string da branch do Neon usada só pelos testes automatizados. |

Em desenvolvimento, deixar os segredos em branco é aceitável: a API gera um
valor aleatório temporário e avisa no terminal (o efeito é que todo mundo é
deslogado quando a API reinicia). Gere segredos de verdade com:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## As três áreas do sistema

- **Site público** (`/`, `/cardapio`, `/login`, `/registo`, `/pedidos`, ...) —
  cardápio, carrinho e pedidos de entrega/retirada.
- **Mesa via QR code** (`/m/<token>`) — sem nenhum link no site público; cada
  mesa tem o seu próprio link, impresso/gerado a partir do que a API mostra
  ao criar o banco.
- **Painel administrativo** (`/admin/login`, `/admin`) — login separado da
  equipe da loja (tabela `administradores`, distinta de `usuarios`), também
  sem link público. Mostra mesas, pedidos e o cardápio em tempo real via
  WebSocket, e permite editar o cardápio (criar produto, marcar
  indisponível, trocar foto).

## Comandos úteis

Na raiz do repositório:

```bash
npm run dev        # sobe o front-end
npm run build      # checa os tipos (tsc) e gera a build de produção
```

Na pasta `apps/web` (se quiser só a checagem de tipos, sem gerar build):

```bash
npm run typecheck
```

Na pasta `apps/api` (com a venv ativada):

```bash
uvicorn app.main:app --reload   # sobe a API
pytest                          # roda os testes do back-end
python -m app.criar_admin       # cria um administrador
```

## Testes do back-end

```bash
cd apps/api
.venv\Scripts\activate
pytest
```

São 39 testes cobrindo autenticação, pedidos, o fluxo de mesa/comanda,
relatórios, a tela da cozinha e as proteções de segurança (bloqueio por
força bruta no login e no registo, upload de arquivo disfarçado, separação
entre token de cliente e de admin, limpeza do contador de tentativas em
memória). Cada teste roda dentro de uma transação isolada na branch `test`
do Neon, revertida ao final — nenhum teste deixa dado para trás nem afeta a
branch de desenvolvimento.

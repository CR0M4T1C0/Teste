import os
import secrets
import sys
from pathlib import Path

from dotenv import load_dotenv

API_DIR = Path(__file__).resolve().parent.parent

load_dotenv(API_DIR / ".env")


def _env(nome: str, padrao: str) -> str:
    valor = os.getenv(nome)
    return valor if valor else padrao


# AMBIENTE controla o quão rígida é a checagem dos segredos abaixo.
#   "desenvolvimento" (padrão) -> aceita segredo gerado na hora, só avisa
#   "producao"                 -> recusa subir sem segredo forte no .env
AMBIENTE = _env("AMBIENTE", "desenvolvimento").strip().lower()
EH_PRODUCAO = AMBIENTE == "producao"

# Valores que existiam como padrão antigo no código — se alguém copiar um .env
# velho, ainda assim tratamos como "não configurado".
_SEGREDOS_PROIBIDOS = {
    "dev-inseguro-cliente-troque-isto",
    "dev-inseguro-admin-troque-isto",
    "troque-este-segredo-de-cliente",
    "troque-este-segredo-de-administrador",
}

_TAMANHO_MINIMO_SEGREDO = 32


def _carregar_segredo(nome: str) -> str:
    """Lê um segredo de JWT do ambiente, recusando valores fracos.

    Antes, um .env ausente fazia a API subir com um segredo fixo escrito no
    próprio código-fonte — ou seja, público. Qualquer pessoa com acesso ao
    repositório conseguiria assinar um token de administrador válido. Agora:

    - em produção, a API se recusa a subir sem um segredo forte de verdade;
    - em desenvolvimento, geramos um segredo aleatório na memória, o que é
      seguro e só tem o efeito colateral de deslogar todo mundo a cada
      reinício da API (aceitável enquanto se desenvolve).
    """
    valor = os.getenv(nome, "").strip()

    valido = valor and valor not in _SEGREDOS_PROIBIDOS and len(valor) >= _TAMANHO_MINIMO_SEGREDO
    if valido:
        return valor

    if EH_PRODUCAO:
        motivo = "não foi definido" if not valor else "é um valor de exemplo ou curto demais"
        print(
            f"\n[burger-tech] ERRO: {nome} {motivo}.\n"
            f"  Em produção (AMBIENTE=producao) isso não é permitido.\n"
            f"  Gere um segredo com:\n"
            f'      python -c "import secrets; print(secrets.token_urlsafe(48))"\n'
            f"  e coloque no arquivo .env antes de subir a API.\n",
            file=sys.stderr,
        )
        raise SystemExit(1)

    print(
        f"[burger-tech] AVISO: {nome} não configurado — usando um segredo aleatório "
        f"temporário. Os logins serão perdidos quando a API reiniciar. "
        f"Copie o .env.example para .env para resolver."
    )
    return secrets.token_urlsafe(48)


JWT_SECRET_CLIENTE = _carregar_segredo("JWT_SECRET_CLIENTE")
JWT_SECRET_ADMIN = _carregar_segredo("JWT_SECRET_ADMIN")

# Os dois segredos precisam ser diferentes: é o que garante que um token de
# cliente nunca possa ser aceito como token de administrador, mesmo que a
# checagem da claim "tipo_conta" falhe por algum bug futuro.
if JWT_SECRET_CLIENTE == JWT_SECRET_ADMIN:
    print(
        "\n[burger-tech] ERRO: JWT_SECRET_CLIENTE e JWT_SECRET_ADMIN são iguais.\n"
        "  Use dois segredos diferentes — é a última barreira que impede um\n"
        "  token de cliente de valer como token de administrador.\n",
        file=sys.stderr,
    )
    raise SystemExit(1)

JWT_ALGORITHM = _env("JWT_ALGORITHM", "HS256")
JWT_EXPIRA_MINUTOS_CLIENTE = int(_env("JWT_EXPIRA_MINUTOS_CLIENTE", "1440"))
JWT_EXPIRA_MINUTOS_ADMIN = int(_env("JWT_EXPIRA_MINUTOS_ADMIN", "480"))

# PostgreSQL (Neon) — branch "production" do time. A suíte de testes lê
# DATABASE_URL_TESTE (branch "test") diretamente em tests/conftest.py, pra
# nunca sujar dados de desenvolvimento — não é uma preocupação da API em
# funcionamento normal, só dos testes.
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    print(
        "\n[burger-tech] ERRO: DATABASE_URL não foi definido no .env.\n"
        "  Copie a connection string do seu projeto no Neon (branch de\n"
        "  desenvolvimento) para apps/api/.env.\n",
        file=sys.stderr,
    )
    raise SystemExit(1)

SCHEMA_PATH = API_DIR / "database" / "schema.sql"
MIGRATIONS_DIR = API_DIR / "database" / "migrations"

# Onde ficam as fotos dos produtos enviadas pelo painel admin (servidas como
# arquivo estático em /uploads — veja main.py)
UPLOADS_DIR = API_DIR / "uploads"
UPLOADS_PRODUTOS_DIR = UPLOADS_DIR / "produtos"

CORS_ORIGINS = [
    o.strip()
    for o in _env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

# Em produção, "*" liberaria qualquer site a chamar a API com as credenciais
# do usuário logado — combinação proibida com allow_credentials=True.
if EH_PRODUCAO and "*" in CORS_ORIGINS:
    print(
        "\n[burger-tech] ERRO: CORS_ORIGINS não pode ser '*' em produção.\n"
        "  Liste explicitamente os domínios do front-end.\n",
        file=sys.stderr,
    )
    raise SystemExit(1)


# ── G.P.T. (Grill Potato Toast) — atendente virtual ─────────────────────────
# A chave fica só aqui, no servidor. Se estivesse no front-end, qualquer
# visitante a leria no DevTools e a usaria por conta própria — e a fatura
# viria para o projeto.
#
# Sem IA_CHAVE definida, o atendente simplesmente não aparece no site. O
# resto do sistema funciona igual: ele é um extra, não um pilar.
IA_PROVEDOR = _env("IA_PROVEDOR", "gemini").strip().lower()
IA_CHAVE = os.getenv("IA_CHAVE", "").strip()
IA_MODELO = _env("IA_MODELO", "gemini-3.6-flash")

# Para onde o G.P.T. cai quando o modelo principal responde 503 ("high
# demand") ou demora demais. O modelo mais recente é o mais disputado; uma
# geração anterior, ainda suportada, costuma estar menos congestionada.
# Deixe vazio para desligar a segunda tentativa.
IA_MODELO_ALTERNATIVO = _env("IA_MODELO_ALTERNATIVO", "gemini-3.5-flash")

# Vale por tentativa, e agora são até duas — por isso o valor caiu de 30s:
# 20 + 20 já é bastante tempo para alguém esperando uma sugestão de lanche.
IA_TIMEOUT_SEGUNDOS = int(_env("IA_TIMEOUT_SEGUNDOS", "20"))

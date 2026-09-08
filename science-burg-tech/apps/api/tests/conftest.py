import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

_API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_API_DIR))

# Carrega o .env manualmente aqui, cedo: precisamos ler DATABASE_URL_TESTE
# antes do primeiro import de app.config (que também chama load_dotenv, mas
# só na hora que for importado — tarde demais para a checagem abaixo).
load_dotenv(_API_DIR / ".env")

# Precisam ter 32+ caracteres e ser diferentes entre si — as mesmas regras
# que o config.py exige de qualquer ambiente.
os.environ["JWT_SECRET_CLIENTE"] = "segredo-de-teste-do-cliente-com-tamanho-suficiente"
os.environ["JWT_SECRET_ADMIN"] = "segredo-de-teste-do-admin-com-tamanho-suficiente"

# Os testes rodam contra a branch "test" do Neon (Postgres), nunca contra a
# branch de desenvolvimento — DATABASE_URL_TESTE precisa estar definida em
# apps/api/.env. Isso precisa acontecer antes do primeiro import de
# app.config, que lê DATABASE_URL do ambiente na hora do import.
_URL_TESTE = os.environ.get("DATABASE_URL_TESTE")
if not _URL_TESTE:
    raise RuntimeError(
        "Defina DATABASE_URL_TESTE no apps/api/.env com a connection string "
        "da branch 'test' do Neon antes de rodar os testes."
    )
os.environ["DATABASE_URL"] = _URL_TESTE

import psycopg  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.db as app_db  # noqa: E402
import app.main as app_main  # noqa: E402
from app.auth_cliente import hash_senha  # noqa: E402
from app.limite_tentativas import limpar_tudo  # noqa: E402
from app.main import app  # noqa: E402

# O schema já existe nas branches do Neon (aplicado manualmente durante a
# migração) — isto só entra em ação se alguém apontar DATABASE_URL_TESTE
# para uma branch nova e vazia.
app_db.inicializar_banco()


@pytest.fixture(autouse=True)
def _zerar_limite_de_tentativas():
    """O contador de tentativas de login vive na memória do processo, então
    é compartilhado por todos os testes. Sem zerar entre um teste e outro,
    um teste que erra a senha de propósito acabaria bloqueando o login de
    outro teste que roda depois."""
    limpar_tudo()
    yield
    limpar_tudo()


@pytest.fixture()
def db(monkeypatch):
    """Cada teste roda dentro de uma única transação Postgres que nunca é
    commitada de verdade: no final ela é sempre revertida, isolando os
    testes uns dos outros e do banco de desenvolvimento sem precisar
    recriar o schema a cada teste (como o SQLite antigo fazia com um
    arquivo novo por teste).

    As rotas chamam `db.commit()` normalmente em produção — aqui isso é
    neutralizado (vira um no-op) para que nada saia da transação antes do
    rollback final. `app.dependency_overrides` garante que as requisições
    feitas pelo `client` (via HTTP) usem esta mesma conexão, e não uma nova
    emprestada do pool — senão o setup feito direto por `db` e o que a API
    grava ficariam em transações diferentes, invisíveis uma para a outra.

    O WebSocket /ws/admin não usa Depends(get_db) — ele abre e fecha uma
    conexão avulsa via _conectar() só para autenticar (de propósito, pra não
    segurar uma conexão do pool pela vida inteira da conexão WebSocket).
    Por isso _conectar() também é trocado aqui, com o close() neutralizado
    do mesmo jeito que o commit(): senão o handler fecharia a conexão
    compartilhada assim que autenticasse, quebrando o resto do teste."""
    conn = psycopg.connect(_URL_TESTE, row_factory=dict_row)
    fechar_de_verdade = conn.close
    conn.commit = lambda: None
    conn.close = lambda: None

    app.dependency_overrides[app_db.get_db] = lambda: conn
    monkeypatch.setattr(app_main, "_conectar", lambda: conn)
    try:
        yield conn
    finally:
        app.dependency_overrides.pop(app_db.get_db, None)
        conn.rollback()
        fechar_de_verdade()


@pytest.fixture()
def client(db):
    # Sem "with": isso pula o lifespan do FastAPI (abrir/fechar o pool de
    # conexões real), que os testes não usam mesmo, já que get_db está
    # sobrescrito acima para devolver sempre a conexão de `db`.
    return TestClient(app)


@pytest.fixture()
def admin_ativo(db):
    db.execute(
        "INSERT INTO administradores (nome, email, senha_hash, papel) VALUES (%s, %s, %s, %s)",
        ("Admin de Teste", "admin@teste.com", hash_senha("senha-admin-123"), "admin"),
    )
    db.commit()
    return {"email": "admin@teste.com", "senha": "senha-admin-123"}

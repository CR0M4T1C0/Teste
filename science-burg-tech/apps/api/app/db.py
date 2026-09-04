import secrets
from collections.abc import Generator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import DATABASE_URL, SCHEMA_PATH

# Linhas voltam como dict (linha["campo"]) — o mesmo jeito de acessar que o
# sqlite3.Row já dava, então nenhum router precisou mudar por causa disso.
pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, kwargs={"row_factory": dict_row}, open=False)


def abrir_pool() -> None:
    pool.open(wait=True, timeout=15)


def fechar_pool() -> None:
    pool.close()


def _conectar() -> psycopg.Connection:
    """Conexão avulsa, fora do pool de requisições — usada só na
    inicialização do banco e em scripts de linha de comando (criar_admin),
    que rodam uma vez e terminam."""
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def inicializar_banco() -> None:
    """Aplica o schema.sql se as tabelas ainda não existirem no banco.

    As tabelas nunca são criadas via ORM — sempre a partir do schema.sql,
    que é a única fonte da verdade (contém os triggers e o índice único
    parcial que implementam as regras de negócio do sistema de mesas).
    """
    conn = _conectar()
    try:
        ja_existe = conn.execute("SELECT to_regclass('public.usuarios') AS existe").fetchone()["existe"]
        if ja_existe is None:
            schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
            conn.execute(schema_sql)
            conn.commit()
            _rotacionar_qr_tokens_do_seed(conn)
    finally:
        conn.close()


def _rotacionar_qr_tokens_do_seed(conn: psycopg.Connection) -> None:
    """Os qr_token inseridos pelo seed do schema.sql são só exemplo
    (previsíveis de propósito, tipo "mesa-01-a1b2c3") — antes de considerar o
    banco pronto pra uso real, trocamos cada um por um token aleatório longo,
    para que ninguém consiga "adivinhar" o link de uma mesa que não é a dela.
    """
    mesas = conn.execute("SELECT id, numero FROM mesas ORDER BY numero").fetchall()
    print("\n[burger-tech] Mesas criadas — links de QR code (rota /m/<token> no front-end):")
    for mesa in mesas:
        token = secrets.token_urlsafe(24)
        conn.execute("UPDATE mesas SET qr_token = %s WHERE id = %s", (token, mesa["id"]))
        print(f"  Mesa {mesa['numero']:>2}: /m/{token}")
    conn.commit()
    print()


def get_db() -> Generator[psycopg.Connection, None, None]:
    """Dependency do FastAPI: empresta uma conexão do pool por requisição e
    devolve no final. Transação sem commit explícito é revertida sozinha
    pelo pool ao devolver a conexão — seguro pra rota só de leitura."""
    with pool.connection() as conn:
        yield conn

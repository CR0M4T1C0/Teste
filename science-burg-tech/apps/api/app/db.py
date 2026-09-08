import secrets
from collections.abc import Generator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import DATABASE_URL, MIGRATIONS_DIR, SCHEMA_PATH

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
    """Aplica o schema.sql (só em banco vazio) e depois qualquer migração de
    database/migrations/ que ainda não tenha rodado nesta branch/banco.

    As tabelas nunca são criadas via ORM — sempre a partir de SQL puro, que é
    a única fonte da verdade (contém os triggers e o índice único parcial que
    implementam as regras de negócio do sistema de mesas). O schema.sql é só
    a fundação histórica (o estado em que o banco nasceu); qualquer mudança
    de schema a partir de agora vira um arquivo novo em migrations/, nunca
    mais uma edição direta no schema.sql — senão bancos que já existem (como
    as branches "production" e "test" de vocês) nunca receberiam a mudança,
    já que este bloco só roda o schema.sql uma vez, em banco vazio.
    """
    conn = _conectar()
    try:
        ja_existe = conn.execute("SELECT to_regclass('public.usuarios') AS existe").fetchone()["existe"]
        if ja_existe is None:
            schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
            conn.execute(schema_sql)
            conn.commit()
            _rotacionar_qr_tokens_do_seed(conn)

        _aplicar_migracoes_pendentes(conn)
    finally:
        conn.close()


def _aplicar_migracoes_pendentes(conn: psycopg.Connection) -> None:
    """Roda, em ordem alfabética/numérica, os arquivos .sql de
    database/migrations/ que ainda não constam na tabela _migrations deste
    banco. Cada arquivo roda e é registrado na sua própria transação — se um
    falhar, os anteriores continuam válidos e a próxima subida da API tenta
    de novo só o que faltou (não fica reaplicando o que já deu certo)."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS _migrations (
          nome         TEXT PRIMARY KEY,
          aplicada_em  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
        )
        """
    )
    conn.commit()

    if not MIGRATIONS_DIR.exists():
        return

    ja_aplicadas = {linha["nome"] for linha in conn.execute("SELECT nome FROM _migrations").fetchall()}

    for arquivo in sorted(MIGRATIONS_DIR.glob("*.sql")):
        if arquivo.name in ja_aplicadas:
            continue
        print(f"[burger-tech] Aplicando migração de banco: {arquivo.name}")
        conn.execute(arquivo.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO _migrations (nome) VALUES (%s)", (arquivo.name,))
        conn.commit()


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

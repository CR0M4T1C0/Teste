"""Cria o primeiro administrador do painel, gerando o hash da senha na hora.

Rode com:
    python -m app.criar_admin

Não existe nenhum administrador de exemplo no seed do banco de propósito —
uma senha "de mentira" com hash fixo no repositório seria um problema de
segurança real (ver database/README.md).
"""

import getpass
import os
import sys

from app.auth_cliente import hash_senha
from app.db import _conectar, inicializar_banco


def criar_admin_do_ambiente() -> None:
    """Cria o primeiro administrador a partir de ADMIN_EMAIL/ADMIN_SENHA.

    Existe porque o plano gratuito do Render não dá acesso a shell: sem isto
    não haveria como rodar o main() interativo contra o banco de produção, e
    o painel administrativo ficaria inalcançável para sempre.

    Só age com a tabela vazia. Essa condição é o que impede a variável de
    ambiente de virar uma porta dos fundos: depois que existe um admin, nada
    aqui cria um segundo nem troca a senha de quem já está lá.
    """
    email = os.getenv("ADMIN_EMAIL", "").strip()
    senha = os.getenv("ADMIN_SENHA", "")
    if not email or not senha:
        return

    db = _conectar()
    try:
        if db.execute("SELECT id FROM administradores LIMIT 1").fetchone() is not None:
            print(
                "[burger-tech] ADMIN_EMAIL/ADMIN_SENHA ignorados: já existe "
                "administrador. Remova as duas variáveis do ambiente.",
                file=sys.stderr,
            )
            return

        if len(senha) < 6:
            print(
                "[burger-tech] ADMIN_SENHA tem menos de 6 caracteres — "
                "administrador inicial não foi criado.",
                file=sys.stderr,
            )
            return

        nome = os.getenv("ADMIN_NOME", "").strip() or email.split("@")[0]
        db.execute(
            "INSERT INTO administradores (nome, email, senha_hash, papel) VALUES (%s, %s, %s, %s)",
            (nome, email, hash_senha(senha), "admin"),
        )
        db.commit()
        print(
            f"[burger-tech] Administrador inicial criado: {email}. "
            "Remova ADMIN_EMAIL e ADMIN_SENHA do painel agora.",
            file=sys.stderr,
        )
    finally:
        db.close()


def main() -> None:
    inicializar_banco()

    nome = input("Nome: ").strip()
    email = input("E-mail: ").strip()
    senha = getpass.getpass("Senha (mín. 6 caracteres): ")
    senha_confirmacao = getpass.getpass("Confirme a senha: ")
    papel = input("Papel [admin/atendente] (padrão: admin): ").strip() or "admin"

    if not nome or not email:
        print("Nome e e-mail são obrigatórios.")
        sys.exit(1)
    if len(senha) < 6:
        print("A senha precisa ter pelo menos 6 caracteres.")
        sys.exit(1)
    if senha != senha_confirmacao:
        print("As senhas não conferem.")
        sys.exit(1)
    if papel not in ("admin", "atendente"):
        print("Papel inválido — use 'admin' ou 'atendente'.")
        sys.exit(1)

    db = _conectar()
    try:
        existente = db.execute("SELECT id FROM administradores WHERE email = %s", (email,)).fetchone()
        if existente is not None:
            print(f"Já existe um administrador com o e-mail {email}.")
            sys.exit(1)

        db.execute(
            "INSERT INTO administradores (nome, email, senha_hash, papel) VALUES (%s, %s, %s, %s)",
            (nome, email, hash_senha(senha), papel),
        )
        db.commit()
    finally:
        db.close()

    print(f"Administrador '{nome}' <{email}> ({papel}) criado com sucesso.")


if __name__ == "__main__":
    main()

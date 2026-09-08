"""Cria o primeiro administrador do painel, gerando o hash da senha na hora.

Rode com:
    python -m app.criar_admin

Não existe nenhum administrador de exemplo no seed do banco de propósito —
uma senha "de mentira" com hash fixo no repositório seria um problema de
segurança real (ver database/README.md).
"""

import getpass
import sys

from app.auth_cliente import hash_senha
from app.db import _conectar, inicializar_banco


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

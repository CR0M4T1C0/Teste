from datetime import datetime, timedelta, timezone
from typing import Optional

import psycopg
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import JWT_ALGORITHM, JWT_EXPIRA_MINUTOS_ADMIN, JWT_SECRET_ADMIN
from app.db import get_db

# Reaproveita o mesmo hash de senha (bcrypt) do lado do cliente — o algoritmo
# de hash não precisa ser diferente, só o segredo do JWT e a tabela de origem.
from app.auth_cliente import hash_senha, verificar_senha  # noqa: F401  (re-exportado para o script de criação de admin)

_bearer_scheme = HTTPBearer(auto_error=False)


def criar_token_admin(administrador_id: int, email: str, papel: str) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRA_MINUTOS_ADMIN)
    claims = {
        "sub": str(administrador_id),
        "email": email,
        "papel": papel,
        "tipo_conta": "admin",
        "exp": expira,
    }
    return jwt.encode(claims, JWT_SECRET_ADMIN, algorithm=JWT_ALGORITHM)


def _decodificar_token_admin(token: str) -> dict:
    try:
        claims = jwt.decode(token, JWT_SECRET_ADMIN, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

    if claims.get("tipo_conta") != "admin":
        # Um token de cliente nunca deve conseguir acessar uma rota /api/admin/...
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido para esta rota")

    return claims


def get_admin_atual(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: psycopg.Connection = Depends(get_db),
) -> dict:
    if credenciais is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")

    claims = _decodificar_token_admin(credenciais.credentials)
    admin = db.execute(
        "SELECT * FROM administradores WHERE id = %s AND ativo = 1", (claims["sub"],)
    ).fetchone()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Administrador não encontrado ou inativo")
    return admin


def exigir_papel_admin(admin: dict = Depends(get_admin_atual)) -> dict:
    if admin["papel"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ação restrita a administradores")
    return admin


def autenticar_admin_websocket(token: str, db: psycopg.Connection) -> Optional[dict]:
    """Mesma verificação de get_admin_atual, mas devolvendo None em vez de
    levantar HTTPException — usada no handshake do WebSocket /ws/admin, que
    recebe o token por query param (o navegador não permite header
    Authorization numa conexão WebSocket nativa)."""
    try:
        claims = jwt.decode(token, JWT_SECRET_ADMIN, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
    if claims.get("tipo_conta") != "admin":
        return None
    return db.execute("SELECT * FROM administradores WHERE id = %s AND ativo = 1", (claims["sub"],)).fetchone()

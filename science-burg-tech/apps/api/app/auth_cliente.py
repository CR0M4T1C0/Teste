import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import psycopg
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import JWT_ALGORITHM, JWT_EXPIRA_MINUTOS_CLIENTE, JWT_SECRET_CLIENTE
from app.db import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# auto_error=False: em rotas de mesa o login é opcional, então tratamos o
# "sem token" manualmente em vez de deixar o FastAPI recusar de cara.
_bearer_scheme = HTTPBearer(auto_error=False)


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha, senha_hash)


# Hash de uma senha aleatória que ninguém conhece, usado só para gastar o
# mesmo tempo de CPU quando o e-mail digitado não existe no banco.
_HASH_FALSO = pwd_context.hash(secrets.token_urlsafe(32))


def gastar_tempo_de_verificacao() -> None:
    """Roda um bcrypt "à toa" quando o usuário não foi encontrado.

    Sem isto, um e-mail inexistente responde na hora e um e-mail existente
    com senha errada demora ~200ms (o custo do bcrypt). Essa diferença de
    tempo permite descobrir quais e-mails têm conta no sistema — é o que se
    chama de enumeração de usuários. Rodando o bcrypt nos dois casos, os
    dois caminhos demoram igual.
    """
    pwd_context.verify("senha-que-nunca-confere", _HASH_FALSO)


def criar_token_cliente(usuario_id: int, email: str) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRA_MINUTOS_CLIENTE)
    claims = {
        "sub": str(usuario_id),
        "email": email,
        "tipo_conta": "cliente",
        "exp": expira,
    }
    return jwt.encode(claims, JWT_SECRET_CLIENTE, algorithm=JWT_ALGORITHM)


def _decodificar_token_cliente(token: str) -> dict:
    try:
        claims = jwt.decode(token, JWT_SECRET_CLIENTE, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")

    if claims.get("tipo_conta") != "cliente":
        # Garante que um token de administrador nunca é aceito aqui, mesmo que
        # tenha sido assinado com a mesma chave por engano em algum ponto.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido para esta rota")

    return claims


def get_usuario_atual(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: psycopg.Connection = Depends(get_db),
) -> dict:
    if credenciais is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")

    claims = _decodificar_token_cliente(credenciais.credentials)
    usuario = db.execute("SELECT * FROM usuarios WHERE id = %s", (claims["sub"],)).fetchone()
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    return usuario


def get_usuario_opcional(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: psycopg.Connection = Depends(get_db),
) -> Optional[dict]:
    if credenciais is None:
        return None
    try:
        claims = _decodificar_token_cliente(credenciais.credentials)
    except HTTPException:
        return None
    return db.execute("SELECT * FROM usuarios WHERE id = %s", (claims["sub"],)).fetchone()

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth_cliente import (
    criar_token_cliente,
    gastar_tempo_de_verificacao,
    get_usuario_atual,
    hash_senha,
    verificar_senha,
)
from app.db import get_db
from app.limite_tentativas import registrar_falha, registrar_sucesso, segundos_de_bloqueio
from app.schemas import LoginIn, RegistoIn, TokenOut, UsuarioOut

router = APIRouter(prefix="/auth", tags=["autenticação de cliente"])


def _linha_para_usuario(linha: dict) -> UsuarioOut:
    return UsuarioOut(id=linha["id"], nome=linha["nome"], email=linha["email"], telefone=linha["telefone"])


def _chave_limite(request: Request, email: str) -> str:
    """Identifica quem está tentando logar, para contar as tentativas.

    Combina IP + e-mail: assim, errar a senha da própria conta não bloqueia o
    e-mail de outra pessoa a partir de outro lugar, e um atacante num IP só
    não consegue varrer vários e-mails sem ser barrado.
    """
    ip = request.client.host if request.client else "desconhecido"
    return f"cliente:{ip}:{email.lower()}"


def _chave_limite_registo(request: Request) -> str:
    """Diferente do login: aqui a chave é só o IP (não faz sentido combinar
    com e-mail, já que cada tentativa de registo costuma usar um e-mail
    diferente). O objetivo é frear alguém tentando descobrir, um por um,
    quais e-mails já têm conta — veja o comentário em `registar()`."""
    ip = request.client.host if request.client else "desconhecido"
    return f"registo:{ip}"


@router.post("/registo", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def registar(dados: RegistoIn, request: Request, db: psycopg.Connection = Depends(get_db)) -> TokenOut:
    chave = _chave_limite_registo(request)

    bloqueado_por = segundos_de_bloqueio(chave)
    if bloqueado_por:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Muitas tentativas de registo. Tente novamente em {bloqueado_por // 60 + 1} minuto(s).",
            headers={"Retry-After": str(bloqueado_por)},
        )

    existente = db.execute("SELECT id FROM usuarios WHERE email = %s", (dados.email,)).fetchone()
    if existente is not None:
        # Aqui ainda dá para descobrir se um e-mail tem conta (a resposta diz
        # "já existe"), diferente do /login — esconder isso de verdade exigiria
        # um fluxo de confirmação por e-mail, fora do escopo deste projeto. O
        # limite de tentativas por IP acima é a mitigação aceita: não impede a
        # descoberta de um e-mail específico, mas impede varrer uma lista
        # inteira rapidamente. Ver SEGURANCA.md.
        registrar_falha(chave)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma conta com este e-mail")

    usuario = db.execute(
        "INSERT INTO usuarios (nome, email, senha_hash, telefone) VALUES (%s, %s, %s, %s) RETURNING *",
        (dados.nome, dados.email, hash_senha(dados.senha), dados.telefone),
    ).fetchone()
    db.commit()
    registrar_sucesso(chave)

    token = criar_token_cliente(usuario["id"], usuario["email"])
    return TokenOut(access_token=token, usuario=_linha_para_usuario(usuario))


@router.post("/login", response_model=TokenOut)
def login(dados: LoginIn, request: Request, db: psycopg.Connection = Depends(get_db)) -> TokenOut:
    chave = _chave_limite(request, dados.email)

    bloqueado_por = segundos_de_bloqueio(chave)
    if bloqueado_por:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Muitas tentativas de login. Tente novamente em {bloqueado_por // 60 + 1} minuto(s).",
            headers={"Retry-After": str(bloqueado_por)},
        )

    usuario = db.execute("SELECT * FROM usuarios WHERE email = %s", (dados.email,)).fetchone()

    if usuario is None:
        # Gasta o mesmo tempo do caminho "senha errada" para não entregar,
        # pelo relógio, se este e-mail tem conta ou não.
        gastar_tempo_de_verificacao()
        registrar_falha(chave)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos")

    if not verificar_senha(dados.senha, usuario["senha_hash"]):
        registrar_falha(chave)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos")

    registrar_sucesso(chave)
    token = criar_token_cliente(usuario["id"], usuario["email"])
    return TokenOut(access_token=token, usuario=_linha_para_usuario(usuario))


@router.get("/me", response_model=UsuarioOut)
def eu(usuario: dict = Depends(get_usuario_atual)) -> UsuarioOut:
    return _linha_para_usuario(usuario)

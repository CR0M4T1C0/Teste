import psycopg
from fastapi import APIRouter, Depends

from app.auth_cliente import get_usuario_atual
from app.db import get_db
from app.schemas import EnderecoOut

router = APIRouter(prefix="/enderecos", tags=["endereços"])


@router.get("", response_model=list[EnderecoOut])
def listar_meus_enderecos(
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[EnderecoOut]:
    """Endereços já usados pelo cliente logado — pra ele escolher um em vez
    de digitar tudo de novo no checkout."""
    linhas = db.execute(
        "SELECT * FROM enderecos WHERE usuario_id = %s ORDER BY padrao DESC, criado_em DESC",
        (usuario["id"],),
    ).fetchall()
    return [
        EnderecoOut(
            id=l["id"],
            rua=l["rua"],
            numero=l["numero"],
            complemento=l["complemento"],
            bairro=l["bairro"],
            cidade=l["cidade"],
            estado=l["estado"],
            cep=l["cep"],
            padrao=bool(l["padrao"]),
        )
        for l in linhas
    ]

from datetime import datetime, timezone

import psycopg
from fastapi import APIRouter, Depends

from app.db import get_db
from app.schemas import PromocaoAdminOut, PromocaoOut

router = APIRouter(tags=["promoções"])


def _hoje() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _linha_para_promocao_admin(linha: dict) -> PromocaoAdminOut:
    return PromocaoAdminOut(
        id=linha["id"],
        titulo=linha["titulo"],
        subtitulo=linha["subtitulo"],
        imagem_url=linha["imagem_url"],
        cupom_id=linha["cupom_id"],
        ordem=linha["ordem"],
        ativo=bool(linha["ativo"]),
        valido_de=linha["valido_de"],
        valido_ate=linha["valido_ate"],
    )


@router.get("/promocoes", response_model=list[PromocaoOut])
def listar_promocoes(db: psycopg.Connection = Depends(get_db)) -> list[PromocaoOut]:
    """Só as promoções ativas e dentro do período de validade — é o que
    alimenta o banner de propaganda no site (home e cardápio)."""
    hoje = _hoje()
    linhas = db.execute(
        """
        SELECT p.*, c.codigo AS cupom_codigo
        FROM promocoes p
        LEFT JOIN cupons c ON c.id = p.cupom_id
        WHERE p.ativo = 1
          AND (p.valido_de IS NULL OR p.valido_de <= %s)
          AND (p.valido_ate IS NULL OR p.valido_ate >= %s)
        ORDER BY p.ordem, p.id
        """,
        (hoje, hoje),
    ).fetchall()
    return [
        PromocaoOut(
            id=linha["id"],
            titulo=linha["titulo"],
            subtitulo=linha["subtitulo"],
            imagem_url=linha["imagem_url"],
            cupom_codigo=linha["cupom_codigo"],
            ordem=linha["ordem"],
            ativo=bool(linha["ativo"]),
            valido_de=linha["valido_de"],
            valido_ate=linha["valido_ate"],
        )
        for linha in linhas
    ]

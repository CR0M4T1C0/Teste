from typing import Optional

import psycopg
from fastapi import APIRouter, Depends

from app.db import get_db
from app.schemas import CategoriaOut, ProdutoOut

router = APIRouter(tags=["cardápio"])


def _linha_para_produto(linha: dict) -> ProdutoOut:
    return ProdutoOut(
        id=linha["id"],
        categoria_id=linha["categoria_id"],
        categoria_slug=linha["categoria_slug"],
        nome=linha["nome"],
        slug=linha["slug"],
        descricao=linha["descricao"],
        preco=linha["preco"],
        calorias=linha["calorias"],
        imagem_url=linha["imagem_url"],
        tag=linha["tag"],
        cor_badge=linha["cor_badge"],
        disponivel=bool(linha["disponivel"]),
    )


@router.get("/categorias", response_model=list[CategoriaOut])
def listar_categorias(db: psycopg.Connection = Depends(get_db)) -> list[CategoriaOut]:
    linhas = db.execute("SELECT * FROM categorias ORDER BY ordem").fetchall()
    return [CategoriaOut(**linha) for linha in linhas]


@router.get("/produtos", response_model=list[ProdutoOut])
def listar_produtos(
    categoria: Optional[str] = None,
    db: psycopg.Connection = Depends(get_db),
) -> list[ProdutoOut]:
    sql = """
        SELECT p.*, c.slug AS categoria_slug
        FROM produtos p
        JOIN categorias c ON c.id = p.categoria_id
        WHERE p.disponivel = 1
    """
    parametros: list[str] = []
    if categoria:
        sql += " AND c.slug = %s"
        parametros.append(categoria)
    sql += " ORDER BY c.ordem, p.id"

    linhas = db.execute(sql, parametros).fetchall()
    return [_linha_para_produto(linha) for linha in linhas]

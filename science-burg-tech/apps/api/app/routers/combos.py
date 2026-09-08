import psycopg
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_db
from app.schemas import ComboItemIn, ComboItemOut, ComboOut

router = APIRouter(tags=["combos"])


def _linha_para_combo(db: psycopg.Connection, linha: dict) -> ComboOut:
    itens_linhas = db.execute(
        """
        SELECT ci.produto_id, ci.quantidade, p.nome
        FROM combo_itens ci
        JOIN produtos p ON p.id = ci.produto_id
        WHERE ci.combo_id = %s
        ORDER BY ci.id
        """,
        (linha["id"],),
    ).fetchall()
    itens = [ComboItemOut(produto_id=i["produto_id"], nome=i["nome"], quantidade=i["quantidade"]) for i in itens_linhas]
    return ComboOut(
        id=linha["id"],
        nome=linha["nome"],
        slug=linha["slug"],
        descricao=linha["descricao"],
        preco=linha["preco"],
        imagem_url=linha["imagem_url"],
        disponivel=bool(linha["disponivel"]),
        itens=itens,
    )


def gravar_itens_combo(db: psycopg.Connection, combo_id: int, itens: list[ComboItemIn]) -> None:
    db.execute("DELETE FROM combo_itens WHERE combo_id = %s", (combo_id,))
    for item in itens:
        produto = db.execute("SELECT id FROM produtos WHERE id = %s", (item.produto_id,)).fetchone()
        if produto is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Produto {item.produto_id} não existe")
        db.execute(
            "INSERT INTO combo_itens (combo_id, produto_id, quantidade) VALUES (%s, %s, %s)",
            (combo_id, item.produto_id, item.quantidade),
        )


@router.get("/combos", response_model=list[ComboOut])
def listar_combos(db: psycopg.Connection = Depends(get_db)) -> list[ComboOut]:
    linhas = db.execute("SELECT * FROM combos WHERE disponivel = 1 ORDER BY id").fetchall()
    return [_linha_para_combo(db, linha) for linha in linhas]

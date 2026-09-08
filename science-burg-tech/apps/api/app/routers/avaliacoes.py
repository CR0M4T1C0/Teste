import psycopg
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth_cliente import get_usuario_atual
from app.db import get_db
from app.schemas import AvaliacaoAdminOut, AvaliacaoCreateIn, AvaliacaoOut

router = APIRouter(tags=["avaliações"])


def _linha_para_avaliacao_admin(linha: dict) -> AvaliacaoAdminOut:
    return AvaliacaoAdminOut(
        id=linha["id"],
        usuario_nome=linha["usuario_nome"],
        pedido_id=linha["pedido_id"],
        nota=linha["nota"],
        comentario=linha["comentario"],
        aprovado=bool(linha["aprovado"]),
        criado_em=linha["criado_em"],
    )


@router.get("/avaliacoes", response_model=list[AvaliacaoOut])
def listar_avaliacoes(db: psycopg.Connection = Depends(get_db)) -> list[AvaliacaoOut]:
    """Só as aprovadas — toda avaliação nasce pendente de moderação (ver
    PATCH /admin/avaliacoes/{id}) antes de aparecer publicamente no site."""
    linhas = db.execute(
        """
        SELECT a.id, a.nota, a.comentario, a.criado_em, u.nome AS usuario_nome
        FROM avaliacoes a
        JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.aprovado = 1
        ORDER BY a.criado_em DESC
        LIMIT 20
        """
    ).fetchall()
    return [
        AvaliacaoOut(
            id=linha["id"], usuario_nome=linha["usuario_nome"], nota=linha["nota"],
            comentario=linha["comentario"], criado_em=linha["criado_em"],
        )
        for linha in linhas
    ]


@router.post("/avaliacoes", response_model=AvaliacaoOut, status_code=status.HTTP_201_CREATED)
def criar_avaliacao(
    dados: AvaliacaoCreateIn,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> AvaliacaoOut:
    pedido = db.execute("SELECT * FROM pedidos WHERE id = %s", (dados.pedido_id,)).fetchone()
    # 404 (não 403) tanto pra pedido inexistente quanto pra pedido de outro
    # cliente — não confirmamos pra quem pergunta que aquele id existe e é
    # de outra pessoa.
    if pedido is None or pedido["usuario_id"] != usuario["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado")
    if pedido["status"] != "entregue":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Só é possível avaliar depois que o pedido for entregue",
        )

    existente = db.execute("SELECT id FROM avaliacoes WHERE pedido_id = %s", (dados.pedido_id,)).fetchone()
    if existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este pedido já foi avaliado")

    linha = db.execute(
        "INSERT INTO avaliacoes (usuario_id, pedido_id, nota, comentario) VALUES (%s, %s, %s, %s) RETURNING id, criado_em",
        (usuario["id"], dados.pedido_id, dados.nota, dados.comentario),
    ).fetchone()
    db.commit()

    return AvaliacaoOut(
        id=linha["id"], usuario_nome=usuario["nome"], nota=dados.nota,
        comentario=dados.comentario, criado_em=linha["criado_em"],
    )

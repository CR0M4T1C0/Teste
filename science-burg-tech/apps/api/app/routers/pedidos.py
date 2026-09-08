import psycopg
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth_cliente import get_usuario_atual
from app.db import get_db
from app.routers.cupons import calcular_cupom
from app.schemas import ItemPedidoIn, ItemPedidoOut, PedidoCreateIn, PedidoOut
from app.websocket import gerenciador_admin

router = APIRouter(prefix="/pedidos", tags=["pedidos"])

# A entrega é grátis no cardápio atual (é o que o carrinho do front-end já
# mostra) — se um dia isso mudar, é só calcular a taxa aqui.
TAXA_ENTREGA = 0.0


def _carregar_itens(db: psycopg.Connection, itens_in: list[ItemPedidoIn]) -> tuple[list[dict], float]:
    """Carrega cada linha do pedido — um produto avulso ou um combo — a
    partir do banco (nunca confiando no preço/nome que o front-end mandou,
    só no id) e devolve as linhas prontas pra gravar mais o subtotal total.
    """
    itens_carregados: list[dict] = []
    subtotal = 0.0

    for item in itens_in:
        if item.combo_id is not None:
            combo = db.execute(
                "SELECT * FROM combos WHERE id = %s AND disponivel = 1", (item.combo_id,)
            ).fetchone()
            if combo is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Combo {item.combo_id} não existe ou não está disponível",
                )
            item_subtotal = combo["preco"] * item.quantidade
            subtotal += item_subtotal
            itens_carregados.append(
                {
                    "produto_id": None,
                    "combo_id": combo["id"],
                    "nome_produto": combo["nome"],
                    "preco_unitario": combo["preco"],
                    "quantidade": item.quantidade,
                    "subtotal": item_subtotal,
                }
            )
        else:
            produto = db.execute(
                "SELECT * FROM produtos WHERE id = %s AND disponivel = 1", (item.produto_id,)
            ).fetchone()
            if produto is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Produto {item.produto_id} não existe ou não está disponível",
                )
            item_subtotal = produto["preco"] * item.quantidade
            subtotal += item_subtotal
            itens_carregados.append(
                {
                    "produto_id": produto["id"],
                    "combo_id": None,
                    "nome_produto": produto["nome"],
                    "preco_unitario": produto["preco"],
                    "quantidade": item.quantidade,
                    "subtotal": item_subtotal,
                }
            )

    return itens_carregados, subtotal


def _salvar_itens_pedido(db: psycopg.Connection, pedido_id: int, itens: list[dict]) -> list[ItemPedidoOut]:
    itens_out: list[ItemPedidoOut] = []
    for item in itens:
        linha = db.execute(
            """
            INSERT INTO itens_pedido (pedido_id, produto_id, combo_id, nome_produto, preco_unitario, quantidade, subtotal)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                pedido_id,
                item["produto_id"],
                item.get("combo_id"),
                item["nome_produto"],
                item["preco_unitario"],
                item["quantidade"],
                item["subtotal"],
            ),
        ).fetchone()
        itens_out.append(
            ItemPedidoOut(
                id=linha["id"],
                produto_id=item["produto_id"],
                combo_id=item.get("combo_id"),
                nome_produto=item["nome_produto"],
                preco_unitario=item["preco_unitario"],
                quantidade=item["quantidade"],
                subtotal=item["subtotal"],
            )
        )
    return itens_out


def _linha_para_pedido(db: psycopg.Connection, linha: dict) -> PedidoOut:
    itens_linhas = db.execute("SELECT * FROM itens_pedido WHERE pedido_id = %s", (linha["id"],)).fetchall()
    itens = [
        ItemPedidoOut(
            id=i["id"],
            produto_id=i["produto_id"],
            combo_id=i["combo_id"],
            nome_produto=i["nome_produto"],
            preco_unitario=i["preco_unitario"],
            quantidade=i["quantidade"],
            subtotal=i["subtotal"],
        )
        for i in itens_linhas
    ]

    cupom_codigo = None
    if linha["cupom_id"] is not None:
        cupom = db.execute("SELECT codigo FROM cupons WHERE id = %s", (linha["cupom_id"],)).fetchone()
        cupom_codigo = cupom["codigo"] if cupom else None

    avaliacao = db.execute("SELECT id FROM avaliacoes WHERE pedido_id = %s", (linha["id"],)).fetchone()

    return PedidoOut(
        id=linha["id"],
        tipo=linha["tipo"],
        status=linha["status"],
        metodo_pagamento=linha["metodo_pagamento"],
        subtotal=linha["subtotal"],
        taxa_entrega=linha["taxa_entrega"],
        desconto=linha["desconto"],
        cupom_codigo=cupom_codigo,
        total=linha["total"],
        observacoes=linha["observacoes"],
        criado_em=linha["criado_em"],
        itens=itens,
        avaliacao_id=avaliacao["id"] if avaliacao else None,
    )


@router.post("", response_model=PedidoOut, status_code=status.HTTP_201_CREATED)
async def criar_pedido(
    dados: PedidoCreateIn,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> PedidoOut:
    if dados.tipo == "entrega" and dados.endereco is None and dados.endereco_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pedido de entrega precisa de um endereço")

    itens_carregados, subtotal = _carregar_itens(db, dados.itens)

    endereco_id = None
    taxa_entrega = 0.0
    if dados.tipo == "entrega":
        if dados.endereco_id is not None:
            # Reaproveita um endereço já salvo — mas só se for mesmo do
            # cliente logado, senão daria pra entregar pedido de qualquer um
            # no endereço de outra pessoa só adivinhando o id.
            existente = db.execute(
                "SELECT id FROM enderecos WHERE id = %s AND usuario_id = %s", (dados.endereco_id, usuario["id"])
            ).fetchone()
            if existente is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endereço não encontrado")
            endereco_id = existente["id"]
        else:
            endereco = dados.endereco
            assert endereco is not None
            linha_endereco = db.execute(
                """
                INSERT INTO enderecos (usuario_id, rua, numero, complemento, bairro, cidade, estado, cep)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (usuario["id"], endereco.rua, endereco.numero, endereco.complemento, endereco.bairro, endereco.cidade, endereco.estado, endereco.cep),
            ).fetchone()
            endereco_id = linha_endereco["id"]
        taxa_entrega = TAXA_ENTREGA

    cupom_id = None
    desconto = 0.0
    if dados.codigo_cupom:
        # Recalcula do zero, com os dados de agora — nunca confiamos num
        # desconto que o front-end mandou (o front só usa /cupons/validar
        # pra mostrar uma prévia antes de confirmar).
        resultado_cupom = calcular_cupom(db, dados.codigo_cupom, usuario["id"], subtotal)
        if not resultado_cupom.valido:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=resultado_cupom.motivo or "Cupom inválido")
        cupom_id = resultado_cupom.cupom_id
        desconto = resultado_cupom.desconto

    total = max(subtotal + taxa_entrega - desconto, 0.0)

    linha_pedido = db.execute(
        """
        INSERT INTO pedidos (usuario_id, tipo, endereco_id, metodo_pagamento, subtotal, taxa_entrega, desconto, cupom_id, total, observacoes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            usuario["id"],
            dados.tipo,
            endereco_id,
            dados.metodo_pagamento,
            subtotal,
            taxa_entrega,
            desconto,
            cupom_id,
            total,
            dados.observacoes,
        ),
    ).fetchone()
    pedido_id = linha_pedido["id"]

    _salvar_itens_pedido(db, pedido_id, itens_carregados)

    if cupom_id is not None:
        db.execute(
            "INSERT INTO cupons_uso (cupom_id, usuario_id, pedido_id) VALUES (%s, %s, %s)",
            (cupom_id, usuario["id"], pedido_id),
        )

    db.commit()

    pedido = db.execute("SELECT * FROM pedidos WHERE id = %s", (pedido_id,)).fetchone()
    pedido_out = _linha_para_pedido(db, pedido)

    # Sem isto, um pedido de entrega/retirada novo nunca aparecia sozinho no
    # painel admin nem na tela da cozinha — só os de mesa avisavam via
    # WebSocket (em mesas.py). Os dois tipos precisam avisar a equipe.
    await gerenciador_admin.broadcast(
        "pedido_criado", {"pedido_id": pedido_id, "tipo": dados.tipo}
    )

    return pedido_out


@router.get("/me", response_model=list[PedidoOut])
def meus_pedidos(
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[PedidoOut]:
    linhas = db.execute(
        "SELECT * FROM pedidos WHERE usuario_id = %s ORDER BY criado_em DESC", (usuario["id"],)
    ).fetchall()
    return [_linha_para_pedido(db, linha) for linha in linhas]

from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import APIRouter, Depends, Query

from app.auth_admin import exigir_papel_admin
from app.db import get_db
from app.schemas import (
    FaturamentoPorDiaOut,
    FaturamentoPorTipoOut,
    PagamentoPorMetodoOut,
    PedidosPorHoraOut,
    ProdutoMaisVendidoOut,
    RelatorioOut,
)

router = APIRouter(prefix="/admin/relatorios", tags=["relatórios"])

# Só o papel "admin" enxerga faturamento — um atendente do salão não precisa
# (e não deveria) ver quanto a loja fatura por dia.
_DiasPeriodo = Query(default=30, ge=1, le=365)


def _desde(dias: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=dias)).strftime("%Y-%m-%d %H:%M:%S")


@router.get("", response_model=RelatorioOut)
def obter_relatorio(
    dias: int = _DiasPeriodo,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> RelatorioOut:
    desde = _desde(dias)

    # Conta como faturamento qualquer pedido não cancelado, dos três tipos —
    # é reconhecido na criação do pedido, não na confirmação de pagamento
    # (o sistema não rastreia "pago" de forma uniforme entre entrega/retirada
    # e mesa: mesa só grava pagamento ao fechar a comanda inteira).
    resumo = db.execute(
        """
        SELECT COUNT(*) AS total_pedidos, COALESCE(SUM(total), 0) AS faturamento_total
        FROM pedidos
        WHERE status != 'cancelado' AND criado_em >= %s
        """,
        (desde,),
    ).fetchone()
    total_pedidos = resumo["total_pedidos"]
    faturamento_total = resumo["faturamento_total"]
    ticket_medio = faturamento_total / total_pedidos if total_pedidos else 0.0

    # criado_em é TEXT no formato fixo 'YYYY-MM-DD HH24:MI:SS' (herdado do
    # schema do SQLite de propósito — ver database/schema.sql), então dá pra
    # recortar a data/hora com SUBSTRING em vez de strftime().
    por_dia = db.execute(
        """
        SELECT SUBSTRING(criado_em, 1, 10) AS data, SUM(total) AS total
        FROM pedidos
        WHERE status != 'cancelado' AND criado_em >= %s
        GROUP BY data
        ORDER BY data
        """,
        (desde,),
    ).fetchall()

    por_tipo = db.execute(
        """
        SELECT tipo, SUM(total) AS total
        FROM pedidos
        WHERE status != 'cancelado' AND criado_em >= %s
        GROUP BY tipo
        ORDER BY total DESC
        """,
        (desde,),
    ).fetchall()

    mais_vendidos = db.execute(
        """
        SELECT ip.nome_produto, SUM(ip.quantidade) AS quantidade, SUM(ip.subtotal) AS total
        FROM itens_pedido ip
        JOIN pedidos p ON p.id = ip.pedido_id
        WHERE p.status != 'cancelado' AND p.criado_em >= %s
        GROUP BY ip.nome_produto
        ORDER BY quantidade DESC
        LIMIT 5
        """,
        (desde,),
    ).fetchall()

    por_hora = db.execute(
        """
        SELECT CAST(SUBSTRING(criado_em, 12, 2) AS INTEGER) AS hora, COUNT(*) AS quantidade
        FROM pedidos
        WHERE status != 'cancelado' AND criado_em >= %s
        GROUP BY hora
        ORDER BY hora
        """,
        (desde,),
    ).fetchall()

    # Forma de pagamento vem de dois lugares diferentes no schema: pedidos de
    # entrega/retirada guardam o método direto em pedidos.metodo_pagamento;
    # pedidos de mesa não guardam individualmente — o pagamento é registrado
    # uma vez por comanda inteira, em "pagamentos", quando ela é fechada.
    # Por isso combinamos as duas fontes aqui em vez de ler só uma tabela.
    metodos: dict[str, float] = {}
    for linha in db.execute(
        """
        SELECT metodo_pagamento AS metodo, SUM(total) AS total
        FROM pedidos
        WHERE tipo IN ('entrega', 'retirada') AND status != 'cancelado'
          AND metodo_pagamento IS NOT NULL AND criado_em >= %s
        GROUP BY metodo_pagamento
        """,
        (desde,),
    ).fetchall():
        metodos[linha["metodo"]] = metodos.get(linha["metodo"], 0.0) + linha["total"]

    for linha in db.execute(
        """
        SELECT metodo, SUM(valor) AS total
        FROM pagamentos
        WHERE status = 'aprovado' AND pago_em >= %s
        GROUP BY metodo
        """,
        (desde,),
    ).fetchall():
        metodos[linha["metodo"]] = metodos.get(linha["metodo"], 0.0) + linha["total"]

    return RelatorioOut(
        periodo_dias=dias,
        faturamento_total=faturamento_total,
        total_pedidos=total_pedidos,
        ticket_medio=ticket_medio,
        faturamento_por_dia=[FaturamentoPorDiaOut(data=l["data"], total=l["total"]) for l in por_dia],
        faturamento_por_tipo=[FaturamentoPorTipoOut(tipo=l["tipo"], total=l["total"]) for l in por_tipo],
        produtos_mais_vendidos=[
            ProdutoMaisVendidoOut(nome_produto=l["nome_produto"], quantidade=l["quantidade"], total=l["total"])
            for l in mais_vendidos
        ],
        pagamentos_por_metodo=[PagamentoPorMetodoOut(metodo=m, total=t) for m, t in metodos.items()],
        pedidos_por_hora=[PedidosPorHoraOut(hora=l["hora"], quantidade=l["quantidade"]) for l in por_hora],
    )

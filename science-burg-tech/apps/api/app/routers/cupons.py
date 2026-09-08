from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import psycopg
from fastapi import APIRouter, Depends

from app.auth_cliente import get_usuario_atual
from app.db import get_db
from app.schemas import CupomOut, CupomValidarIn, CupomValidarOut

router = APIRouter(tags=["cupons"])


@dataclass
class ResultadoCupom:
    valido: bool
    motivo: Optional[str] = None
    cupom_id: Optional[int] = None
    codigo: Optional[str] = None
    desconto: float = 0.0


def _hoje() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def calcular_cupom(db: psycopg.Connection, codigo: str, usuario_id: int, subtotal: float) -> ResultadoCupom:
    """Valida um código de cupom para um pedido e calcula o desconto.

    Usada tanto no endpoint de pré-visualização (POST /cupons/validar,
    pra mostrar "-R$X" antes de confirmar) quanto de novo, autoritativamente,
    dentro de POST /pedidos — nunca confiamos num desconto que o front-end
    mandou, o valor final é sempre recalculado aqui com os dados atuais.
    """
    codigo_normalizado = codigo.strip().upper()
    cupom = db.execute("SELECT * FROM cupons WHERE codigo = %s AND ativo = 1", (codigo_normalizado,)).fetchone()
    if cupom is None:
        return ResultadoCupom(valido=False, motivo="Cupom não encontrado ou inativo")

    hoje = _hoje()
    if cupom["valido_de"] and hoje < cupom["valido_de"]:
        return ResultadoCupom(valido=False, motivo="Este cupom ainda não está válido")
    if cupom["valido_ate"] and hoje > cupom["valido_ate"]:
        return ResultadoCupom(valido=False, motivo="Este cupom expirou")

    if subtotal < cupom["valor_minimo_pedido"]:
        return ResultadoCupom(
            valido=False,
            motivo=f"Pedido mínimo de R$ {cupom['valor_minimo_pedido']:.2f} para usar este cupom",
        )

    if cupom["limite_uso_total"] is not None:
        usados = db.execute(
            "SELECT COUNT(*) AS n FROM cupons_uso WHERE cupom_id = %s", (cupom["id"],)
        ).fetchone()["n"]
        if usados >= cupom["limite_uso_total"]:
            return ResultadoCupom(valido=False, motivo="Este cupom atingiu o limite de usos")

    if cupom["limite_uso_por_usuario"] is not None:
        usados_pelo_usuario = db.execute(
            "SELECT COUNT(*) AS n FROM cupons_uso WHERE cupom_id = %s AND usuario_id = %s",
            (cupom["id"], usuario_id),
        ).fetchone()["n"]
        if usados_pelo_usuario >= cupom["limite_uso_por_usuario"]:
            return ResultadoCupom(valido=False, motivo="Você já usou este cupom o máximo de vezes permitido")

    if cupom["tipo_desconto"] == "percentual":
        desconto = subtotal * (cupom["valor"] / 100)
    else:
        desconto = cupom["valor"]
    desconto = min(desconto, subtotal)  # nunca deixa o pedido negativo

    return ResultadoCupom(valido=True, cupom_id=cupom["id"], codigo=cupom["codigo"], desconto=round(desconto, 2))


def _linha_para_cupom(linha: dict) -> CupomOut:
    return CupomOut(
        id=linha["id"],
        codigo=linha["codigo"],
        tipo_desconto=linha["tipo_desconto"],
        valor=linha["valor"],
        valor_minimo_pedido=linha["valor_minimo_pedido"],
        limite_uso_total=linha["limite_uso_total"],
        limite_uso_por_usuario=linha["limite_uso_por_usuario"],
        valido_de=linha["valido_de"],
        valido_ate=linha["valido_ate"],
        ativo=bool(linha["ativo"]),
    )


@router.post("/cupons/validar", response_model=CupomValidarOut)
def validar_cupom(
    dados: CupomValidarIn,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> CupomValidarOut:
    resultado = calcular_cupom(db, dados.codigo, usuario["id"], dados.subtotal)
    return CupomValidarOut(
        valido=resultado.valido, motivo=resultado.motivo, codigo=resultado.codigo, desconto=resultado.desconto
    )

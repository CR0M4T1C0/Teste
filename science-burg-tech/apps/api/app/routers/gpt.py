"""G.P.T. — Grill Potato Toast, o atendente virtual da burgtech.

Fluxo de uma conversa:
  1. o navegador manda o histórico curto da conversa;
  2. a API busca o cardápio e as promoções ATUAIS no banco;
  3. tudo isso vira o prompt de sistema e vai para o provedor de IA;
  4. a resposta em texto volta para a tela.

Nada é gravado no banco: a conversa vive só na memória do navegador. Foi uma
decisão consciente — guardar conversa de cliente traria responsabilidade de
privacidade (LGPD) sem benefício para o objetivo do projeto.
"""

import sys

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.db import get_db
from app.ia import IAIndisponivel, gerar_resposta, ia_configurada, montar_prompt_do_sistema
from app.limite_gpt import registrar_uso, segundos_de_espera
from app.schemas import GptConversaIn, GptRespostaOut

router = APIRouter(prefix="/gpt", tags=["G.P.T. (atendente virtual)"])

# Mensagem usada quando a IA não está configurada ou não respondeu. O site
# continua funcionando normalmente: o atendente é um extra, não um pilar.
FORA_DO_AR = (
    "Opa! Meu processador deu uma esquentada e estou fora do ar por enquanto. "
    "Dá uma olhada no cardápio que tem coisa boa lá."
)


def _montar_cardapio(db: psycopg.Connection) -> str:
    """Descreve o cardápio em texto, para virar contexto do modelo.

    Só produtos disponíveis entram: assim o G.P.T. nunca recomenda algo que
    está fora de estoque. O preço vem do banco, não do modelo.
    """
    linhas = db.execute(
        """
        SELECT c.nome AS categoria, p.nome, p.descricao, p.preco, p.calorias, p.tag
        FROM produtos p
        JOIN categorias c ON c.id = p.categoria_id
        WHERE p.disponivel = 1
        ORDER BY c.ordem, p.id
        """
    ).fetchall()

    if not linhas:
        return "(cardápio vazio no momento)"

    por_categoria: dict[str, list[str]] = {}
    for l in linhas:
        item = f"- {l['nome']} — R$ {l['preco']:.2f}"
        if l["descricao"]:
            item += f" — {l['descricao']}"
        if l["calorias"]:
            item += f" ({l['calorias']} kcal)"
        if l["tag"]:
            item += f" [{l['tag']}]"
        por_categoria.setdefault(l["categoria"], []).append(item)

    blocos = []
    for categoria, itens in por_categoria.items():
        blocos.append(f"{categoria}:\n" + "\n".join(itens))
    return "\n\n".join(blocos)


def _montar_promocoes(db: psycopg.Connection) -> str:
    """Lista promoções vigentes, se a tabela existir neste banco."""
    try:
        linhas = db.execute(
            """
            SELECT titulo, descricao
            FROM promocoes
            WHERE ativo = TRUE
              AND (inicio_em IS NULL OR inicio_em <= NOW())
              AND (fim_em IS NULL OR fim_em >= NOW())
            ORDER BY id
            """
        ).fetchall()
    except psycopg.Error:
        # Banco sem a migração de promoções: segue sem essa parte do contexto.
        return ""
    return "\n".join(f"- {l['titulo']}: {l['descricao'] or ''}".strip() for l in linhas)


def _chave_uso(request: Request) -> str:
    ip = request.client.host if request.client else "desconhecido"
    return f"gpt:{ip}"


@router.get("/status")
def status_gpt() -> dict:
    """Diz ao front se vale a pena mostrar o botão do atendente."""
    return {"disponivel": ia_configurada()}


@router.post("/conversar", response_model=GptRespostaOut)
def conversar(
    dados: GptConversaIn,
    request: Request,
    db: psycopg.Connection = Depends(get_db),
) -> GptRespostaOut:
    # Cada chamada ao provedor custa dinheiro e consome cota. Sem limite,
    # um script conseguiria esgotar a cota do projeto em minutos.
    espera = segundos_de_espera(_chave_uso(request))
    if espera:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Calma aí! Espere {espera} segundo(s) antes de mandar outra mensagem.",
            headers={"Retry-After": str(espera)},
        )

    if not ia_configurada():
        return GptRespostaOut(resposta=FORA_DO_AR, disponivel=False)

    sistema = montar_prompt_do_sistema(_montar_cardapio(db), _montar_promocoes(db))
    historico = [{"autor": m.autor, "texto": m.texto} for m in dados.mensagens]

    registrar_uso(_chave_uso(request))

    try:
        resposta = gerar_resposta(sistema, historico)
    except IAIndisponivel as e:
        # O erro real fica no log do servidor; o cliente vê algo amigável.
        # Detalhe de provedor ou chave nunca vaza para o navegador. Sem este
        # log, uma chave recusada é indistinguível de um provedor fora do ar:
        # o site mostra a mesma frase amigável nos dois casos.
        print(f"[burger-tech] G.P.T. indisponível: {e}", file=sys.stderr)
        return GptRespostaOut(resposta=FORA_DO_AR, disponivel=False)

    return GptRespostaOut(resposta=resposta, disponivel=True)

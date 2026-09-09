"""Integração com o provedor de IA que dá voz ao G.P.T.

G.P.T. = Grill Potato Toast, o atendente virtual da Science Burg Tech.

Por que este módulo existe separado do router:
  - a chamada externa fica isolada, então trocar de provedor (Gemini,
    OpenAI, Anthropic) não mexe em mais nada do sistema;
  - a chave da API nunca chega ao navegador. O front conversa só com a
    nossa API, e é ela quem fala com o provedor. Se a chave estivesse no
    front-end, qualquer pessoa abriria o DevTools e a usaria por conta.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from app.config import IA_CHAVE, IA_MODELO, IA_PROVEDOR, IA_TIMEOUT_SEGUNDOS


class IAIndisponivel(Exception):
    """O provedor não respondeu, recusou a chave ou não está configurado.

    O router trata isso devolvendo uma mensagem amigável em vez de um erro
    500: um atendente fora do ar não pode derrubar o site inteiro.
    """


def ia_configurada() -> bool:
    return bool(IA_CHAVE)


# ── Prompt de sistema ────────────────────────────────────────────────────────
# As regras abaixo existem para conter os dois riscos reais de usar um modelo
# de linguagem num site de vendas: inventar produto que não existe e inventar
# preço. Por isso o cardápio real é injetado a cada conversa e o modelo é
# proibido de sair dele.
INSTRUCOES = """Você é o G.P.T. (Grill Potato Toast), o atendente virtual da \
hamburgueria Science Burg Tech.

Personalidade: simpático, direto e com um humor leve de "nerd de tecnologia" \
— trocadilhos com termos de informática são bem-vindos, mas sem exagero e \
sem atrapalhar a clareza. Fale português do Brasil, de forma natural.

REGRAS QUE VOCÊ NUNCA QUEBRA:
1. Só recomende itens que estejam na lista CARDÁPIO abaixo. Se o cliente \
pedir algo que não existe lá, diga que não temos e ofereça a alternativa \
mais parecida que exista.
2. Nunca invente preço, ingrediente, prazo de entrega ou promoção. Se a \
informação não estiver no CARDÁPIO ou nas PROMOÇÕES, diga que não sabe e \
sugira falar com a equipe.
3. Você não fecha pedidos, não altera carrinho e não cancela nada. Você \
sugere; quem confirma é o cliente, pelo site.
4. Não peça nem repita dados sensíveis (senha, cartão, CPF, endereço \
completo).
5. Se perguntarem algo fora do universo da hamburgueria, responda \
brevemente que seu assunto é o cardápio e volte ao tema.
6. Respostas curtas: no máximo 4 frases, a não ser que peçam detalhe.

Se o cliente estiver indeciso, faça UMA pergunta objetiva (ex.: "prefere \
carne, frango ou vegetariano?") em vez de listar o cardápio inteiro."""


def montar_prompt_do_sistema(cardapio: str, promocoes: str) -> str:
    partes = [INSTRUCOES, "\n\n=== CARDÁPIO (fonte da verdade) ===\n", cardapio]
    if promocoes.strip():
        partes.append("\n\n=== PROMOÇÕES ATIVAS ===\n")
        partes.append(promocoes)
    return "".join(partes)


# ── Chamada ao provedor ──────────────────────────────────────────────────────


def _post_json(url: str, corpo: dict, cabecalhos: dict) -> dict:
    dados = json.dumps(corpo).encode("utf-8")
    req = urllib.request.Request(url, data=dados, headers=cabecalhos, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=IA_TIMEOUT_SEGUNDOS) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode("utf-8", errors="replace")[:300]
        raise IAIndisponivel(f"provedor respondeu {e.code}: {detalhe}") from e
    except Exception as e:  # timeout, DNS, conexão recusada
        raise IAIndisponivel(str(e)) from e


def _gerar_gemini(sistema: str, historico: list[dict]) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{IA_MODELO}:generateContent"
    corpo = {
        "systemInstruction": {"parts": [{"text": sistema}]},
        "contents": [
            {
                "role": "model" if m["autor"] == "gpt" else "user",
                "parts": [{"text": m["texto"]}],
            }
            for m in historico
        ],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600},
    }
    # As chaves novas do AI Studio vêm no formato "AQ." (auth key) em vez do
    # antigo "AIzaSy" — o Google descontinuou o parâmetro "?key=" pra elas,
    # exigindo o header abaixo. Ele também funciona com chave no formato
    # antigo, então não precisa distinguir os dois casos aqui.
    dados = _post_json(
        url, corpo, {"Content-Type": "application/json", "x-goog-api-key": IA_CHAVE}
    )
    try:
        return dados["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        raise IAIndisponivel("resposta do provedor veio em formato inesperado")


def _gerar_openai(sistema: str, historico: list[dict]) -> str:
    mensagens = [{"role": "system", "content": sistema}]
    mensagens += [
        {"role": "assistant" if m["autor"] == "gpt" else "user", "content": m["texto"]}
        for m in historico
    ]
    corpo = {"model": IA_MODELO, "messages": mensagens, "temperature": 0.3, "max_tokens": 600}
    dados = _post_json(
        "https://api.openai.com/v1/chat/completions",
        corpo,
        {"Content-Type": "application/json", "Authorization": f"Bearer {IA_CHAVE}"},
    )
    try:
        return dados["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        raise IAIndisponivel("resposta do provedor veio em formato inesperado")


def _gerar_anthropic(sistema: str, historico: list[dict]) -> str:
    corpo = {
        "model": IA_MODELO,
        "max_tokens": 600,
        "temperature": 0.3,
        "system": sistema,
        "messages": [
            {"role": "assistant" if m["autor"] == "gpt" else "user", "content": m["texto"]}
            for m in historico
        ],
    }
    dados = _post_json(
        "https://api.anthropic.com/v1/messages",
        corpo,
        {
            "Content-Type": "application/json",
            "x-api-key": IA_CHAVE,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        return dados["content"][0]["text"].strip()
    except (KeyError, IndexError):
        raise IAIndisponivel("resposta do provedor veio em formato inesperado")


_PROVEDORES = {"gemini": _gerar_gemini, "openai": _gerar_openai, "anthropic": _gerar_anthropic}


def gerar_resposta(sistema: str, historico: list[dict]) -> str:
    """Envia a conversa ao provedor e devolve o texto da resposta.

    `historico` é uma lista de {"autor": "cliente"|"gpt", "texto": str},
    do mais antigo para o mais recente, terminando na fala do cliente.
    """
    if not ia_configurada():
        raise IAIndisponivel("IA_CHAVE não configurada no .env")

    gerar = _PROVEDORES.get(IA_PROVEDOR)
    if gerar is None:
        raise IAIndisponivel(
            f"provedor '{IA_PROVEDOR}' desconhecido — use gemini, openai ou anthropic"
        )
    return gerar(sistema, historico)

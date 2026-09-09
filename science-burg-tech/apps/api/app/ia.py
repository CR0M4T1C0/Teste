"""Integração com o provedor de IA que dá voz ao G.P.T.

G.P.T. = Grill Potato Toast, o atendente virtual da burgtech.

Por que este módulo existe separado do router:
  - a chamada externa fica isolada, então trocar de provedor (Gemini,
    OpenAI, Anthropic) não mexe em mais nada do sistema;
  - a chave da API nunca chega ao navegador. O front conversa só com a
    nossa API, e é ela quem fala com o provedor. Se a chave estivesse no
    front-end, qualquer pessoa abriria o DevTools e a usaria por conta.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

from app.config import (
    IA_CHAVE,
    IA_MODELO,
    IA_MODELO_ALTERNATIVO,
    IA_PROVEDOR,
    IA_TIMEOUT_SEGUNDOS,
)


class IAIndisponivel(Exception):
    """O provedor não respondeu, recusou a chave ou não está configurado.

    O router trata isso devolvendo uma mensagem amigável em vez de um erro
    500: um atendente fora do ar não pode derrubar o site inteiro.

    `temporaria` separa "o provedor está sobrecarregado agora" de "esta
    requisição está errada". Só a primeira vale uma segunda tentativa — e só
    ela merece dizer ao cliente que é para tentar de novo daqui a pouco.
    """

    def __init__(self, mensagem: str, temporaria: bool = False) -> None:
        super().__init__(mensagem)
        self.temporaria = temporaria


def ia_configurada() -> bool:
    return bool(IA_CHAVE)


# ── Prompt de sistema ────────────────────────────────────────────────────────
# As regras abaixo existem para conter os dois riscos reais de usar um modelo
# de linguagem num site de vendas: inventar produto que não existe e inventar
# preço. Por isso o cardápio real é injetado a cada conversa e o modelo é
# proibido de sair dele.
INSTRUCOES = """Você é o G.P.T. (Grill Potato Toast), o atendente virtual da \
hamburgueria burgtech.

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


def _post_json(url: str, corpo: dict, cabecalhos: dict, modelo: str) -> dict:
    dados = json.dumps(corpo).encode("utf-8")
    req = urllib.request.Request(url, data=dados, headers=cabecalhos, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=IA_TIMEOUT_SEGUNDOS) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # O corpo do erro vem como JSON indentado. Colapsar os espaços em
        # branco mantém a mensagem inteira numa única linha: agregadores de
        # log (o do Render, por exemplo) quebram por "\n" e só a primeira
        # linha — um "{" solitário — sobreviveria ao filtro de busca.
        bruto = e.read().decode("utf-8", errors="replace")
        detalhe = " ".join(bruto.split())[:400]
        # 429/500/502/503 dizem "estou sobrecarregado", não "seu pedido está
        # errado": a mesma chamada tende a funcionar daqui a pouco. Chave
        # recusada (401/403) ou modelo inexistente (404) falhariam igual numa
        # segunda tentativa, então não vale fazer o cliente esperar o dobro.
        raise IAIndisponivel(
            f"provedor={IA_PROVEDOR} modelo={modelo} respondeu {e.code}: {detalhe}",
            temporaria=e.code in (429, 500, 502, 503),
        ) from e
    except TimeoutError as e:
        raise IAIndisponivel(f"modelo={modelo}: tempo esgotado ({e})", temporaria=True) from e
    except urllib.error.URLError as e:
        raise IAIndisponivel(
            f"modelo={modelo}: {e}", temporaria=isinstance(e.reason, TimeoutError)
        ) from e
    except Exception as e:  # DNS, conexão recusada, JSON inválido
        raise IAIndisponivel(f"modelo={modelo}: {e}") from e


def _gerar_gemini(sistema: str, historico: list[dict], modelo: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    corpo = {
        "systemInstruction": {"parts": [{"text": sistema}]},
        "contents": [
            {
                "role": "model" if m["autor"] == "gpt" else "user",
                "parts": [{"text": m["texto"]}],
            }
            for m in historico
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 600,
            # O gemini-3.6-flash raciocina em nível "medium" por padrão, e
            # isso estourava o timeout: toda conversa caía no texto de fallback.
            # Recomendar item de cardápio não exige raciocínio longo, então o
            # nível baixo troca um ganho que não usaríamos por uma resposta que
            # chega a tempo. Não combinar com thinkingBudget: os dois juntos são
            # recusados com 400.
            "thinkingConfig": {"thinkingLevel": "low"},
        },
    }
    # As chaves novas do AI Studio vêm no formato "AQ." (auth key) em vez do
    # antigo "AIzaSy" — o Google descontinuou o parâmetro "?key=" pra elas,
    # exigindo o header abaixo. Ele também funciona com chaves no formato
    # antigo, então não precisa distinguir os dois casos aqui.
    dados = _post_json(
        url, corpo, {"Content-Type": "application/json", "x-goog-api-key": IA_CHAVE}, modelo
    )
    try:
        return dados["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        raise IAIndisponivel("resposta do provedor veio em formato inesperado")


def _gerar_openai(sistema: str, historico: list[dict], modelo: str) -> str:
    mensagens = [{"role": "system", "content": sistema}]
    mensagens += [
        {"role": "assistant" if m["autor"] == "gpt" else "user", "content": m["texto"]}
        for m in historico
    ]
    corpo = {"model": modelo, "messages": mensagens, "temperature": 0.3, "max_tokens": 600}
    dados = _post_json(
        "https://api.openai.com/v1/chat/completions",
        corpo,
        {"Content-Type": "application/json", "Authorization": f"Bearer {IA_CHAVE}"},
        modelo,
    )
    try:
        return dados["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        raise IAIndisponivel("resposta do provedor veio em formato inesperado")


def _gerar_anthropic(sistema: str, historico: list[dict], modelo: str) -> str:
    corpo = {
        "model": modelo,
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
        modelo,
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

    Falha temporária no modelo principal cai para o alternativo. O modelo mais
    recente é também o mais disputado: o principal vinha respondendo 503
    ("high demand") e estourando o tempo, e uma geração anterior costuma estar
    menos congestionada. Sem isso, um único 503 já virava "estou fora do ar"
    para o cliente.
    """
    if not ia_configurada():
        raise IAIndisponivel("IA_CHAVE não configurada no .env")

    gerar = _PROVEDORES.get(IA_PROVEDOR)
    if gerar is None:
        raise IAIndisponivel(
            f"provedor '{IA_PROVEDOR}' desconhecido — use gemini, openai ou anthropic"
        )

    modelos = [IA_MODELO]
    if IA_MODELO_ALTERNATIVO and IA_MODELO_ALTERNATIVO != IA_MODELO:
        modelos.append(IA_MODELO_ALTERNATIVO)

    ultima_falha: IAIndisponivel | None = None
    for modelo in modelos:
        try:
            return gerar(sistema, historico, modelo)
        except IAIndisponivel as e:
            # Chave recusada ou modelo inexistente falhariam igual na segunda
            # tentativa: só fariam o cliente esperar o dobro para ver o mesmo
            # erro. Só sobrecarga e lentidão valem tentar o outro modelo.
            if not e.temporaria:
                raise
            ultima_falha = e
            print(f"[burger-tech] {e} — tentando o próximo modelo", file=sys.stderr)

    assert ultima_falha is not None
    raise ultima_falha

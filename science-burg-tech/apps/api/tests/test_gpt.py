"""Testes do G.P.T. (Grill Potato Toast).

Estes testes não tocam no provedor de IA nem no PostgreSQL: o banco é
substituído por um objeto falso e a função que chama o provedor é trocada
por uma versão controlada. Assim a suíte roda offline, de graça e rápido.
"""

import os

import pytest

os.environ.setdefault("IA_CHAVE", "")

from fastapi.testclient import TestClient  # noqa: E402

from app import limite_gpt  # noqa: E402
from app.ia import IAIndisponivel  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import gpt as rgpt  # noqa: E402


class _CursorFalso:
    def __init__(self, linhas):
        self._linhas = linhas

    def fetchall(self):
        return self._linhas


class _BancoFalso:
    """Devolve um cardápio e uma promoção fixos, sem PostgreSQL."""

    def execute(self, sql, *args):
        if "FROM produtos" in sql:
            return _CursorFalso([{
                "categoria": "Burgers", "nome": "Bit Burguer",
                "descricao": "carne e cheddar", "preco": 32.0,
                "calorias": 700, "tag": "Top",
            }])
        return _CursorFalso([{"titulo": "Terça em dobro", "descricao": "2 por 1"}])


@pytest.fixture()
def client():
    app.dependency_overrides[rgpt.get_db] = lambda: _BancoFalso()
    limite_gpt.limpar_tudo()
    with TestClient(app) as c:
        yield c
    limite_gpt.limpar_tudo()
    app.dependency_overrides.pop(rgpt.get_db, None)


@pytest.fixture()
def ia_ligada(monkeypatch):
    """Liga o atendente com um provedor controlado e devolve o que foi enviado."""
    capturado = {}

    def gerar(sistema, historico):
        capturado["sistema"] = sistema
        capturado["historico"] = historico
        return "Recomendo o Bit Burguer!"

    monkeypatch.setattr(rgpt, "ia_configurada", lambda: True)
    monkeypatch.setattr(rgpt, "gerar_resposta", gerar)
    return capturado


# ── Sem IA configurada ──────────────────────────────────────────────────────


def test_status_indica_indisponivel_sem_chave(client):
    assert client.get("/api/gpt/status").json() == {"disponivel": False}


def test_sem_chave_responde_amigavel_e_nao_quebra(client):
    r = client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "oi"}]})
    assert r.status_code == 200
    assert r.json()["disponivel"] is False
    assert "fora do ar" in r.json()["resposta"].lower()


def test_ia_desligada_nao_consome_cota(client):
    """Sem chamada paga, não faz sentido gastar o limite do visitante."""
    client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "a"}]})
    r = client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "b"}]})
    assert r.status_code == 200


# ── Validação de entrada ────────────────────────────────────────────────────


@pytest.mark.parametrize("corpo", [
    {"mensagens": []},
    {"mensagens": [{"autor": "cliente", "texto": "x" * 601}]},
    {"mensagens": [{"autor": "invasor", "texto": "oi"}]},
    {"mensagens": [{"autor": "cliente", "texto": ""}]},
])
def test_recusa_entrada_invalida(client, corpo):
    assert client.post("/api/gpt/conversar", json=corpo).status_code == 422


# ── Com IA ligada ───────────────────────────────────────────────────────────


def test_responde_usando_o_provedor(client, ia_ligada):
    r = client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "o que tem?"}]})
    assert r.status_code == 200
    assert r.json() == {"resposta": "Recomendo o Bit Burguer!", "disponivel": True}


def test_cardapio_real_vai_no_prompt(client, ia_ligada):
    """O modelo só pode recomendar o que existe: o cardápio do banco entra
    no contexto, com o preço vindo da tabela e não da imaginação dele."""
    client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "oi"}]})
    sistema = ia_ligada["sistema"]
    assert "Bit Burguer" in sistema
    assert "32.00" in sistema
    assert "Terça em dobro" in sistema
    assert "NUNCA QUEBRA" in sistema


def test_historico_repassado_na_ordem(client, ia_ligada):
    conversa = [
        {"autor": "cliente", "texto": "oi"},
        {"autor": "gpt", "texto": "olá!"},
        {"autor": "cliente", "texto": "tem vegetariano?"},
    ]
    client.post("/api/gpt/conversar", json={"mensagens": conversa})
    assert ia_ligada["historico"] == conversa


def test_limite_bloqueia_mensagens_em_rajada(client, ia_ligada):
    client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "oi"}]})
    r = client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "de novo"}]})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


# ── Falha do provedor ───────────────────────────────────────────────────────


def test_falha_do_provedor_nao_derruba_o_site(client, monkeypatch):
    """Se o provedor cair, o cliente vê uma mensagem simpática — não um 500."""
    def quebrar(sistema, historico):
        raise IAIndisponivel("chave invalida: sk-SEGREDO123")

    monkeypatch.setattr(rgpt, "ia_configurada", lambda: True)
    monkeypatch.setattr(rgpt, "gerar_resposta", quebrar)

    r = client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "oi"}]})
    assert r.status_code == 200
    assert r.json()["disponivel"] is False


def test_erro_do_provedor_nao_vaza_para_o_cliente(client, monkeypatch):
    """Detalhe de chave ou de provedor jamais pode aparecer no navegador."""
    def quebrar(sistema, historico):
        raise IAIndisponivel("chave invalida: sk-SEGREDO123")

    monkeypatch.setattr(rgpt, "ia_configurada", lambda: True)
    monkeypatch.setattr(rgpt, "gerar_resposta", quebrar)

    r = client.post("/api/gpt/conversar", json={"mensagens": [{"autor": "cliente", "texto": "oi"}]})
    assert "SEGREDO123" not in r.text

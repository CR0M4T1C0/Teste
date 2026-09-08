"""Testes das proteções de segurança adicionadas ao login, ao registo e ao
upload.

Cada teste aqui existe por causa de um ataque concreto:
  - força bruta de senha
  - descobrir quais e-mails têm conta (enumeração de usuários), tanto pelo
    login quanto pelo registo
  - subir um arquivo que não é imagem para uma pasta pública
  - o dicionário de tentativas crescer para sempre em memória
"""

import time

import app.limite_tentativas as limite_tentativas
from app.limite_tentativas import MAXIMO_TENTATIVAS


def _registar_cliente(client, email="vitima@teste.com", senha="senha-correta-123"):
    resposta = client.post(
        "/api/auth/registo",
        json={"nome": "Cliente Teste", "email": email, "senha": senha},
    )
    assert resposta.status_code == 201
    return email, senha


def test_login_cliente_bloqueia_apos_varias_tentativas_erradas(client):
    email, _ = _registar_cliente(client)

    # Todas as tentativas dentro da cota respondem 401 normalmente.
    for _ in range(MAXIMO_TENTATIVAS):
        resposta = client.post("/api/auth/login", json={"email": email, "senha": "errada"})
        assert resposta.status_code == 401

    # A tentativa seguinte já encontra a porta fechada...
    resposta = client.post("/api/auth/login", json={"email": email, "senha": "errada"})
    assert resposta.status_code == 429
    assert "Retry-After" in resposta.headers

    # ...e a partir daí nem a senha certa passa, enquanto durar o bloqueio.
    resposta = client.post("/api/auth/login", json={"email": email, "senha": "senha-correta-123"})
    assert resposta.status_code == 429


def test_login_bem_sucedido_zera_o_contador(client):
    email, senha = _registar_cliente(client, email="ok@teste.com")

    for _ in range(MAXIMO_TENTATIVAS - 1):
        client.post("/api/auth/login", json={"email": email, "senha": "errada"})

    # Acertar a senha limpa o histórico...
    assert client.post("/api/auth/login", json={"email": email, "senha": senha}).status_code == 200

    # ...então ainda sobra a cota inteira de tentativas depois disso.
    for _ in range(MAXIMO_TENTATIVAS - 1):
        resposta = client.post("/api/auth/login", json={"email": email, "senha": "errada"})
        assert resposta.status_code == 401


def test_login_admin_tambem_e_limitado(client, admin_ativo):
    for _ in range(MAXIMO_TENTATIVAS):
        resposta = client.post(
            "/api/admin/auth/login", json={"email": admin_ativo["email"], "senha": "errada"}
        )
        assert resposta.status_code == 401

    resposta = client.post(
        "/api/admin/auth/login", json={"email": admin_ativo["email"], "senha": "errada"}
    )
    assert resposta.status_code == 429


def test_email_inexistente_devolve_a_mesma_mensagem_de_senha_errada(client):
    """Se a mensagem fosse diferente ("e-mail não cadastrado" vs "senha
    incorreta"), daria para descobrir quem tem conta no site só pelo texto."""
    email, _ = _registar_cliente(client, email="existe@teste.com")

    resposta_senha_errada = client.post("/api/auth/login", json={"email": email, "senha": "errada"})
    resposta_email_inexistente = client.post(
        "/api/auth/login", json={"email": "nao-existe@teste.com", "senha": "errada"}
    )

    assert resposta_senha_errada.status_code == resposta_email_inexistente.status_code == 401
    assert resposta_senha_errada.json()["detail"] == resposta_email_inexistente.json()["detail"]


def test_registo_tambem_e_limitado_por_ip(client):
    """O /login esconde se um e-mail existe (mensagem igual + tempo igual),
    mas o /registo não tem como esconder isso — a resposta precisa dizer
    "esse e-mail já existe" para o usuário saber que deve entrar em vez de
    criar conta de novo. A mitigação aceita aqui é o limite por IP: não
    impede descobrir UM e-mail específico, mas impede varrer uma lista
    inteira rapidamente. Ver SEGURANCA.md."""
    _registar_cliente(client, email="ja-existe@teste.com")

    for _ in range(MAXIMO_TENTATIVAS):
        resposta = client.post(
            "/api/auth/registo",
            json={"nome": "Outro", "email": "ja-existe@teste.com", "senha": "senha-123456"},
        )
        assert resposta.status_code == 409

    resposta = client.post(
        "/api/auth/registo",
        json={"nome": "Outro", "email": "mais-um@teste.com", "senha": "senha-123456"},
    )
    assert resposta.status_code == 429
    assert "Retry-After" in resposta.headers


def test_registo_bem_sucedido_nao_e_penalizado(client):
    """Só falhas (e-mail duplicado) contam para o limite — registar contas
    novas legitimamente, uma atrás da outra, nunca deveria travar."""
    for i in range(MAXIMO_TENTATIVAS + 2):
        resposta = client.post(
            "/api/auth/registo",
            json={"nome": "Cliente", "email": f"cliente{i}@teste.com", "senha": "senha-123456"},
        )
        assert resposta.status_code == 201


def _token_admin(client, admin_ativo) -> str:
    resposta = client.post("/api/admin/auth/login", json=admin_ativo)
    assert resposta.status_code == 200
    return resposta.json()["access_token"]


def test_upload_recusa_arquivo_que_nao_e_imagem_de_verdade(client, admin_ativo):
    """Um HTML disfarçado de PNG: o content-type mente, os bytes não."""
    token = _token_admin(client, admin_ativo)

    resposta = client.post(
        "/api/admin/upload-imagem",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("falso.png", b"<html><script>alert(1)</script></html>", "image/png")},
    )
    assert resposta.status_code == 400


def test_upload_aceita_png_de_verdade(client, admin_ativo):
    token = _token_admin(client, admin_ativo)

    # PNG mínimo válido: assinatura + cabeçalho IHDR.
    png = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    )
    resposta = client.post(
        "/api/admin/upload-imagem",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("real.png", png, "image/png")},
    )
    assert resposta.status_code == 200
    assert resposta.json()["url"].startswith("/uploads/produtos/")


def test_upload_exige_autenticacao_de_admin(client):
    resposta = client.post(
        "/api/admin/upload-imagem",
        files={"file": ("x.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert resposta.status_code == 401


def test_token_de_cliente_nao_abre_rota_de_admin(client):
    resposta = client.post(
        "/api/auth/registo",
        json={"nome": "Cliente", "email": "cliente@teste.com", "senha": "senha-123456"},
    )
    token_cliente = resposta.json()["access_token"]

    resposta = client.get("/api/admin/pedidos", headers={"Authorization": f"Bearer {token_cliente}"})
    assert resposta.status_code == 401


def test_limite_de_tentativas_nao_cresce_para_sempre(monkeypatch):
    """Sem limpeza periódica, cada chave (IP+e-mail) que já apareceu uma vez
    ficaria para sempre no dicionário em memória, mesmo depois de expirada —
    um ataque de enumeração com um e-mail diferente a cada tentativa faria
    isso crescer sem limite enquanto o processo roda."""
    limite_tentativas.limpar_tudo()
    limite_tentativas.registrar_falha("chave-orfa-de-teste")
    assert "chave-orfa-de-teste" in limite_tentativas._tentativas

    # Avança o relógio além da janela de tentativas E do intervalo de
    # limpeza, para a próxima chamada disparar a varredura completa.
    agora_futuro = (
        time.monotonic()
        + limite_tentativas.JANELA_SEGUNDOS
        + limite_tentativas.INTERVALO_LIMPEZA_SEGUNDOS
        + 10
    )
    monkeypatch.setattr(limite_tentativas.time, "monotonic", lambda: agora_futuro)

    limite_tentativas.registrar_falha("outra-chave-qualquer")

    assert "chave-orfa-de-teste" not in limite_tentativas._tentativas
    limite_tentativas.limpar_tudo()

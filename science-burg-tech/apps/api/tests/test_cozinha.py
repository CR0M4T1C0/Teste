def _token_admin(client, admin_ativo) -> str:
    resposta = client.post("/api/admin/auth/login", json=admin_ativo)
    assert resposta.status_code == 200
    return resposta.json()["access_token"]


def _criar_pedido_retirada(client, produto_id, email="cozinha-cliente@teste.com"):
    registo = client.post("/api/auth/registo", json={"nome": "Cliente", "email": email, "senha": "senha-123456"})
    token_cliente = registo.json()["access_token"]
    resposta = client.post(
        "/api/pedidos",
        json={"tipo": "retirada", "itens": [{"produto_id": produto_id, "quantidade": 1}]},
        headers={"Authorization": f"Bearer {token_cliente}"},
    )
    assert resposta.status_code == 201
    return resposta.json()


def test_cozinha_exige_autenticacao(client):
    assert client.get("/api/admin/cozinha").status_code == 401


def test_cozinha_junta_pedido_de_mesa_e_de_retirada(client, admin_ativo, db):
    produto = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()
    _criar_pedido_retirada(client, produto["id"])

    mesa = db.execute("SELECT qr_token FROM mesas WHERE status = 'livre' LIMIT 1").fetchone()
    client.post(f"/api/mesas/{mesa['qr_token']}/pedidos", json={"itens": [{"produto_id": produto["id"], "quantidade": 1}]})

    token_admin = _token_admin(client, admin_ativo)
    resposta = client.get("/api/admin/cozinha", headers={"Authorization": f"Bearer {token_admin}"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    tipos = {p["tipo"] for p in corpo}
    assert tipos == {"retirada", "local"}


def test_cozinha_esconde_pedido_ja_finalizado(client, admin_ativo, db):
    produto = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()
    pedido = _criar_pedido_retirada(client, produto["id"], email="finalizado@teste.com")
    token_admin = _token_admin(client, admin_ativo)

    client.patch(
        f"/api/admin/pedidos/{pedido['id']}/status",
        json={"status": "entregue"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )

    resposta = client.get("/api/admin/cozinha", headers={"Authorization": f"Bearer {token_admin}"})
    ids = {p["id"] for p in resposta.json()}
    assert pedido["id"] not in ids


def test_criar_pedido_de_entrega_avisa_a_cozinha_pelo_websocket(client, admin_ativo, db):
    """Antes desta fase, só pedido de mesa avisava o painel — um pedido de
    retirada/entrega criado ficava mudo até alguém atualizar a página."""
    token_admin = _token_admin(client, admin_ativo)
    produto = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()

    with client.websocket_connect(f"/ws/admin?token={token_admin}") as ws:
        _criar_pedido_retirada(client, produto["id"], email="websocket@teste.com")
        mensagem = ws.receive_json()
        assert mensagem["evento"] == "pedido_criado"
        assert mensagem["dados"]["tipo"] == "retirada"

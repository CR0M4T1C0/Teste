def _registar_e_logar(client, email="cliente@teste.com"):
    resposta = client.post("/api/auth/registo", json={"nome": "Cliente", "email": email, "senha": "senha123"})
    return resposta.json()["access_token"]


def test_criar_pedido_de_retirada_e_ver_historico(client, db):
    token = _registar_e_logar(client)
    produto_id = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()["id"]

    resposta = client.post(
        "/api/pedidos",
        json={"tipo": "retirada", "itens": [{"produto_id": produto_id, "quantidade": 2}]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resposta.status_code == 201
    pedido = resposta.json()
    assert pedido["tipo"] == "retirada"
    assert pedido["status"] == "pendente"
    assert len(pedido["itens"]) == 1
    assert pedido["itens"][0]["quantidade"] == 2

    resposta = client.get("/api/pedidos/me", headers={"Authorization": f"Bearer {token}"})
    assert resposta.status_code == 200
    assert len(resposta.json()) == 1


def test_pedido_de_entrega_sem_endereco_falha(client, db):
    token = _registar_e_logar(client)
    produto_id = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()["id"]

    resposta = client.post(
        "/api/pedidos",
        json={"tipo": "entrega", "itens": [{"produto_id": produto_id, "quantidade": 1}]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resposta.status_code == 400


def test_pedido_com_produto_inexistente_falha(client):
    token = _registar_e_logar(client)
    resposta = client.post(
        "/api/pedidos",
        json={"tipo": "retirada", "itens": [{"produto_id": 999999, "quantidade": 1}]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resposta.status_code == 400


def test_criar_pedido_sem_login_falha(client, db):
    produto_id = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()["id"]
    resposta = client.post(
        "/api/pedidos",
        json={"tipo": "retirada", "itens": [{"produto_id": produto_id, "quantidade": 1}]},
    )
    assert resposta.status_code == 401

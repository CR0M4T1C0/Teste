ENDERECO_EXEMPLO = {
    "rua": "Rua das Flores",
    "numero": "123",
    "complemento": "Apto 4",
    "bairro": "Centro",
    "cidade": "São Paulo",
    "estado": "SP",
    "cep": "01000-000",
}


def _registar(client, email="cliente-enderecos@teste.com"):
    resposta = client.post("/api/auth/registo", json={"nome": "Cliente", "email": email, "senha": "senha-123456"})
    return resposta.json()["access_token"]


def test_listar_enderecos_exige_login(client):
    assert client.get("/api/enderecos").status_code == 401


def test_lista_vazia_para_cliente_novo(client):
    token = _registar(client)
    resposta = client.get("/api/enderecos", headers={"Authorization": f"Bearer {token}"})
    assert resposta.status_code == 200
    assert resposta.json() == []


def test_pedido_de_entrega_salva_o_endereco_pra_reaproveitar(client, db):
    token = _registar(client)
    produto_id = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()["id"]

    client.post(
        "/api/pedidos",
        json={"tipo": "entrega", "itens": [{"produto_id": produto_id, "quantidade": 1}], "endereco": ENDERECO_EXEMPLO},
        headers={"Authorization": f"Bearer {token}"},
    )

    resposta = client.get("/api/enderecos", headers={"Authorization": f"Bearer {token}"})
    enderecos = resposta.json()
    assert len(enderecos) == 1
    assert enderecos[0]["rua"] == "Rua das Flores"


def test_pedido_com_endereco_id_reaproveita_sem_duplicar(client, db):
    token = _registar(client, email="reaproveita@teste.com")
    produto_id = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()["id"]

    primeiro = client.post(
        "/api/pedidos",
        json={"tipo": "entrega", "itens": [{"produto_id": produto_id, "quantidade": 1}], "endereco": ENDERECO_EXEMPLO},
        headers={"Authorization": f"Bearer {token}"},
    )
    enderecos = client.get("/api/enderecos", headers={"Authorization": f"Bearer {token}"}).json()
    endereco_id = enderecos[0]["id"]

    segundo = client.post(
        "/api/pedidos",
        json={"tipo": "entrega", "itens": [{"produto_id": produto_id, "quantidade": 2}], "endereco_id": endereco_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert segundo.status_code == 201

    enderecos_depois = client.get("/api/enderecos", headers={"Authorization": f"Bearer {token}"}).json()
    assert len(enderecos_depois) == 1  # não duplicou


def test_endereco_id_de_outro_cliente_e_recusado(client, db):
    token_dono = _registar(client, email="dono@teste.com")
    token_estranho = _registar(client, email="estranho@teste.com")
    produto_id = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()["id"]

    client.post(
        "/api/pedidos",
        json={"tipo": "entrega", "itens": [{"produto_id": produto_id, "quantidade": 1}], "endereco": ENDERECO_EXEMPLO},
        headers={"Authorization": f"Bearer {token_dono}"},
    )
    endereco_id = client.get("/api/enderecos", headers={"Authorization": f"Bearer {token_dono}"}).json()[0]["id"]

    resposta = client.post(
        "/api/pedidos",
        json={"tipo": "entrega", "itens": [{"produto_id": produto_id, "quantidade": 1}], "endereco_id": endereco_id},
        headers={"Authorization": f"Bearer {token_estranho}"},
    )
    assert resposta.status_code == 404

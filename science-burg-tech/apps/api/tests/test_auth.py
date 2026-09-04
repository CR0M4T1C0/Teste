def test_registo_e_login(client):
    resposta = client.post(
        "/api/auth/registo",
        json={"nome": "Ana Cliente", "email": "ana@teste.com", "senha": "senha123"},
    )
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["usuario"]["email"] == "ana@teste.com"
    assert corpo["access_token"]

    resposta = client.post("/api/auth/login", json={"email": "ana@teste.com", "senha": "senha123"})
    assert resposta.status_code == 200
    assert resposta.json()["usuario"]["nome"] == "Ana Cliente"


def test_login_com_senha_errada_falha(client):
    client.post("/api/auth/registo", json={"nome": "Ana", "email": "ana2@teste.com", "senha": "senha123"})
    resposta = client.post("/api/auth/login", json={"email": "ana2@teste.com", "senha": "errada"})
    assert resposta.status_code == 401


def test_registo_com_email_duplicado_falha(client):
    client.post("/api/auth/registo", json={"nome": "Ana", "email": "dup@teste.com", "senha": "senha123"})
    resposta = client.post("/api/auth/registo", json={"nome": "Outra Ana", "email": "dup@teste.com", "senha": "outrasenha"})
    assert resposta.status_code == 409


def test_token_de_cliente_nao_acessa_rota_de_admin(client):
    registo = client.post("/api/auth/registo", json={"nome": "Ana", "email": "ana3@teste.com", "senha": "senha123"})
    token_cliente = registo.json()["access_token"]

    resposta = client.get("/api/admin/mesas", headers={"Authorization": f"Bearer {token_cliente}"})
    assert resposta.status_code == 401


def test_token_de_admin_nao_acessa_rota_de_cliente(client, admin_ativo):
    login = client.post("/api/admin/auth/login", json=admin_ativo)
    token_admin = login.json()["access_token"]

    resposta = client.get("/api/pedidos/me", headers={"Authorization": f"Bearer {token_admin}"})
    assert resposta.status_code == 401

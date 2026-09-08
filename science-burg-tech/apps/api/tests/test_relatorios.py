from app.auth_cliente import hash_senha


def _token_admin(client, admin_ativo) -> str:
    resposta = client.post("/api/admin/auth/login", json=admin_ativo)
    assert resposta.status_code == 200
    return resposta.json()["access_token"]


def _criar_pedido_retirada(client, db, email, produto_id, quantidade=1):
    registo = client.post(
        "/api/auth/registo", json={"nome": "Cliente", "email": email, "senha": "senha-123456"}
    )
    token_cliente = registo.json()["access_token"]
    resposta = client.post(
        "/api/pedidos",
        json={"tipo": "retirada", "itens": [{"produto_id": produto_id, "quantidade": quantidade}], "metodo_pagamento": "pix"},
        headers={"Authorization": f"Bearer {token_cliente}"},
    )
    assert resposta.status_code == 201
    return resposta.json()


def test_relatorio_exige_token(client):
    assert client.get("/api/admin/relatorios").status_code == 401


def test_relatorio_recusa_atendente(client, admin_ativo, db):
    db.execute(
        "INSERT INTO administradores (nome, email, senha_hash, papel) VALUES (%s, %s, %s, %s)",
        ("Atendente", "atendente@teste.com", hash_senha("senha-123456"), "atendente"),
    )
    db.commit()
    resposta = client.post("/api/admin/auth/login", json={"email": "atendente@teste.com", "senha": "senha-123456"})
    token = resposta.json()["access_token"]

    resposta = client.get("/api/admin/relatorios", headers={"Authorization": f"Bearer {token}"})
    assert resposta.status_code == 403


def test_relatorio_soma_faturamento_e_ticket_medio(client, admin_ativo, db):
    produto = db.execute("SELECT id, preco FROM produtos LIMIT 1").fetchone()
    _criar_pedido_retirada(client, db, "cliente1@teste.com", produto["id"], quantidade=2)
    _criar_pedido_retirada(client, db, "cliente2@teste.com", produto["id"], quantidade=1)

    token_admin = _token_admin(client, admin_ativo)
    resposta = client.get("/api/admin/relatorios", headers={"Authorization": f"Bearer {token_admin}"})
    assert resposta.status_code == 200
    corpo = resposta.json()

    esperado = produto["preco"] * 3
    assert corpo["total_pedidos"] == 2
    assert corpo["faturamento_total"] == esperado
    assert corpo["ticket_medio"] == esperado / 2
    assert corpo["produtos_mais_vendidos"][0]["quantidade"] == 3


def test_relatorio_ignora_pedido_cancelado(client, admin_ativo, db):
    produto = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()
    pedido = _criar_pedido_retirada(client, db, "cancelado@teste.com", produto["id"])

    token_admin = _token_admin(client, admin_ativo)
    client.patch(
        f"/api/admin/pedidos/{pedido['id']}/status",
        json={"status": "cancelado"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )

    resposta = client.get("/api/admin/relatorios", headers={"Authorization": f"Bearer {token_admin}"})
    assert resposta.json()["total_pedidos"] == 0


def test_relatorio_respeita_janela_de_dias(client, admin_ativo, db):
    produto = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()
    pedido = _criar_pedido_retirada(client, db, "antigo@teste.com", produto["id"])

    # "Volta no tempo" o pedido pra fora da janela de 7 dias, sem precisar
    # esperar de verdade — só pra provar que o filtro de período funciona.
    db.execute(
        """
        UPDATE pedidos
        SET criado_em = to_char(now() AT TIME ZONE 'UTC' - interval '30 days', 'YYYY-MM-DD HH24:MI:SS')
        WHERE id = %s
        """,
        (pedido["id"],),
    )
    db.commit()

    token_admin = _token_admin(client, admin_ativo)
    resposta = client.get("/api/admin/relatorios?dias=7", headers={"Authorization": f"Bearer {token_admin}"})
    assert resposta.json()["total_pedidos"] == 0

    resposta = client.get("/api/admin/relatorios?dias=90", headers={"Authorization": f"Bearer {token_admin}"})
    assert resposta.json()["total_pedidos"] == 1

def test_mesa_com_token_invalido_da_404(client):
    resposta = client.get("/api/mesas/token-que-nao-existe")
    assert resposta.status_code == 404


def test_abrir_mesa_pelo_qr_cria_comanda(client, db):
    mesa = db.execute("SELECT id, numero, qr_token FROM mesas WHERE status = 'livre' LIMIT 1").fetchone()

    resposta = client.get(f"/api/mesas/{mesa['qr_token']}")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["mesa"]["numero"] == mesa["numero"]
    assert corpo["comanda"]["status"] == "aberta"
    assert corpo["comanda"]["itens"] == []

    mesa_atualizada = db.execute("SELECT status FROM mesas WHERE id = %s", (mesa["id"],)).fetchone()
    assert mesa_atualizada["status"] == "ocupada"


def test_pedido_na_mesa_e_fechamento_de_comanda_pelo_admin(client, db, admin_ativo):
    mesa = db.execute("SELECT qr_token FROM mesas WHERE status = 'livre' LIMIT 1").fetchone()
    produto = db.execute("SELECT id, preco FROM produtos LIMIT 1").fetchone()

    resposta = client.post(
        f"/api/mesas/{mesa['qr_token']}/pedidos",
        json={"itens": [{"produto_id": produto["id"], "quantidade": 3}]},
    )
    assert resposta.status_code == 201
    comanda = resposta.json()["comanda"]
    assert comanda["total"] == produto["preco"] * 3

    # A mesma mesa não pode ter uma segunda comanda aberta ao mesmo tempo —
    # pedir de novo deve reaproveitar a comanda já aberta, não criar outra.
    resposta = client.post(
        f"/api/mesas/{mesa['qr_token']}/pedidos",
        json={"itens": [{"produto_id": produto["id"], "quantidade": 1}]},
    )
    comanda_id = resposta.json()["comanda"]["id"]
    assert comanda_id == comanda["id"]

    login_admin = client.post("/api/admin/auth/login", json=admin_ativo)
    token_admin = login_admin.json()["access_token"]
    cabecalho_admin = {"Authorization": f"Bearer {token_admin}"}

    mesas_admin = client.get("/api/admin/mesas", headers=cabecalho_admin).json()
    mesa_no_painel = next(m for m in mesas_admin if m["comanda"] and m["comanda"]["id"] == comanda_id)
    assert mesa_no_painel["mesa"]["status"] == "ocupada"
    assert len(mesa_no_painel["comanda"]["itens"]) == 2

    resposta = client.patch(
        f"/api/admin/comandas/{comanda_id}/fechar",
        json={"metodo": "pix"},
        headers=cabecalho_admin,
    )
    assert resposta.status_code == 200

    mesa_status = db.execute(
        "SELECT m.status FROM mesas m JOIN comandas c ON c.mesa_id = m.id WHERE c.id = %s", (comanda_id,)
    ).fetchone()
    assert mesa_status["status"] == "livre"

    comanda_status = db.execute("SELECT status FROM comandas WHERE id = %s", (comanda_id,)).fetchone()
    assert comanda_status["status"] == "paga"

    pagamento = db.execute("SELECT * FROM pagamentos WHERE comanda_id = %s", (comanda_id,)).fetchone()
    assert pagamento["metodo"] == "pix"
    assert pagamento["status"] == "aprovado"


def test_pedir_a_conta_sem_comanda_aberta_da_404(client, db):
    mesa = db.execute("SELECT qr_token FROM mesas WHERE status = 'livre' LIMIT 1").fetchone()
    resposta = client.post(f"/api/mesas/{mesa['qr_token']}/fechar")
    assert resposta.status_code == 404


def test_pedir_a_conta_avisa_a_equipe(client, db):
    mesa = db.execute("SELECT qr_token FROM mesas WHERE status = 'livre' LIMIT 1").fetchone()
    produto = db.execute("SELECT id FROM produtos LIMIT 1").fetchone()
    client.post(f"/api/mesas/{mesa['qr_token']}/pedidos", json={"itens": [{"produto_id": produto["id"], "quantidade": 1}]})

    resposta = client.post(f"/api/mesas/{mesa['qr_token']}/fechar")
    assert resposta.status_code == 202

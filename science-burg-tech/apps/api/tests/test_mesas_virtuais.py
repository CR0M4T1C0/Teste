"""Testes do recurso social "Network da Fome" (mesas virtuais).

Assim como test_mesas.py testa as mesas físicas, este arquivo cobre o fluxo
inteiro das mesas virtuais: sentar/sair, lotação, chat em tempo real via
WebSocket, denúncia, bloqueio e moderação do admin.

O WebSocket de uma mesa (`websocket_mesa`, em app/routers/mesas_virtuais.py)
abre sua própria conexão com `_conectar()` para autenticar — igual ao
WebSocket do admin em app/main.py. O `conn_mesas_virtuais` abaixo troca essa
função pela mesma conexão de teste usada pelo resto do arquivo, do mesmo
jeito que o fixture `db` do conftest.py já faz para `app_main._conectar`.
"""

import pytest

import app.routers.mesas_virtuais as mesas_virtuais_router


@pytest.fixture(autouse=True)
def _usar_conexao_de_teste_no_websocket(db, monkeypatch):
    monkeypatch.setattr(mesas_virtuais_router, "_conectar", lambda: db)


def _registar_e_logar(client, email="ana@teste.com", nome="Ana"):
    resposta = client.post("/api/auth/registo", json={"nome": nome, "email": email, "senha": "senha123"})
    corpo = resposta.json()
    return corpo["access_token"], corpo["usuario"]


def _cabecalho(token):
    return {"Authorization": f"Bearer {token}"}


def _mesa_com_capacidade(db, capacidade):
    return db.execute("SELECT id FROM mesas_virtuais WHERE capacidade = %s AND ativa = 1 LIMIT 1", (capacidade,)).fetchone()


# ── Salão e ocupação ──────────────────────────────────────────────────────────


def test_listar_mesas_nao_exige_login(client):
    resposta = client.get("/api/mesas-virtuais")
    assert resposta.status_code == 200
    mesas = resposta.json()
    assert len(mesas) >= 10
    assert {"id", "nome", "capacidade", "tema", "lugares_ocupados", "lugares_disponiveis", "cheia", "participantes"} <= mesas[0].keys()


def test_sentar_sem_login_falha(client, db):
    mesa = _mesa_com_capacidade(db, 2)
    resposta = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={})
    assert resposta.status_code == 401


def test_sentar_e_ocupar_lugares_ate_lotar(client, db):
    mesa = _mesa_com_capacidade(db, 2)
    token_ana, ana = _registar_e_logar(client, "ana@teste.com", "Ana")
    token_lucas, lucas = _registar_e_logar(client, "lucas@teste.com", "Lucas")
    token_carla, carla = _registar_e_logar(client, "carla@teste.com", "Carla")

    r1 = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    assert r1.status_code == 200
    assert r1.json()["meu_lugar"] == 1

    r2 = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_lucas))
    assert r2.status_code == 200
    assert r2.json()["meu_lugar"] == 2

    # mesa de 2 lugares já está cheia — a terceira pessoa não consegue sentar
    r3 = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_carla))
    assert r3.status_code == 409

    listagem = client.get("/api/mesas-virtuais").json()
    mesa_na_lista = next(m for m in listagem if m["id"] == mesa["id"])
    assert mesa_na_lista["cheia"] is True
    assert mesa_na_lista["lugares_ocupados"] == 2


def test_sentar_em_lugar_especifico_ja_ocupado_da_conflito(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, _ = _registar_e_logar(client, "ana@teste.com", "Ana")
    token_lucas, _ = _registar_e_logar(client, "lucas@teste.com", "Lucas")

    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={"lugar_numero": 2}, headers=_cabecalho(token_ana))
    resposta = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={"lugar_numero": 2}, headers=_cabecalho(token_lucas))
    assert resposta.status_code == 409


def test_sentar_de_novo_na_mesma_mesa_mantem_o_lugar(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token, _ = _registar_e_logar(client)
    primeira = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token)).json()
    segunda = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token)).json()
    assert primeira["meu_lugar"] == segunda["meu_lugar"]


def test_sentar_em_outra_mesa_levanta_da_anterior(client, db):
    mesa_a = _mesa_com_capacidade(db, 4)
    mesa_b = db.execute("SELECT id FROM mesas_virtuais WHERE capacidade = 4 AND id != %s LIMIT 1", (mesa_a["id"],)).fetchone()
    token, usuario = _registar_e_logar(client)

    client.post(f"/api/mesas-virtuais/{mesa_a['id']}/sentar", json={}, headers=_cabecalho(token))
    resposta = client.post(f"/api/mesas-virtuais/{mesa_b['id']}/sentar", json={}, headers=_cabecalho(token))
    assert resposta.status_code == 200

    ainda_na_mesa_a = db.execute(
        "SELECT 1 FROM mesas_virtuais_participantes WHERE usuario_id = %s AND mesa_virtual_id = %s AND saiu_em IS NULL",
        (usuario["id"], mesa_a["id"]),
    ).fetchone()
    assert ainda_na_mesa_a is None


def test_sair_libera_o_lugar_na_hora(client, db):
    mesa = _mesa_com_capacidade(db, 2)
    token_ana, _ = _registar_e_logar(client, "ana@teste.com", "Ana")
    token_lucas, _ = _registar_e_logar(client, "lucas@teste.com", "Lucas")

    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_lucas))

    resposta = client.post(f"/api/mesas-virtuais/{mesa['id']}/sair", headers=_cabecalho(token_ana))
    assert resposta.status_code == 204

    token_carla, _ = _registar_e_logar(client, "carla@teste.com", "Carla")
    resposta = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_carla))
    assert resposta.status_code == 200
    assert resposta.json()["meu_lugar"] == 1  # o lugar 1 (da Ana) é o que estava livre


def test_sair_de_mesa_que_nao_esta_sentado_da_404(client, db):
    mesa = _mesa_com_capacidade(db, 2)
    token, _ = _registar_e_logar(client)
    resposta = client.post(f"/api/mesas-virtuais/{mesa['id']}/sair", headers=_cabecalho(token))
    assert resposta.status_code == 404


# ── Chat (histórico via REST + WebSocket ao vivo) ───────────────────────────


def test_listar_mensagens_exige_estar_sentado(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token, _ = _registar_e_logar(client)
    resposta = client.get(f"/api/mesas-virtuais/{mesa['id']}/mensagens", headers=_cabecalho(token))
    assert resposta.status_code == 403


def test_websocket_recusa_quem_nao_esta_sentado(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token, _ = _registar_e_logar(client)
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/mesas-virtuais/{mesa['id']}?token={token}"):
            pass  # a API fecha a conexão com código 4403 antes de qualquer troca


def test_chat_via_websocket_e_persistido_e_entregue_em_tempo_real(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, ana = _registar_e_logar(client, "ana@teste.com", "Ana")
    token_lucas, lucas = _registar_e_logar(client, "lucas@teste.com", "Lucas")
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_lucas))

    with client.websocket_connect(f"/ws/mesas-virtuais/{mesa['id']}?token={token_ana}") as ws_ana:
        with client.websocket_connect(f"/ws/mesas-virtuais/{mesa['id']}?token={token_lucas}") as ws_lucas:
            ws_ana.send_json({"tipo": "chat", "texto": "Alguém já experimentou o novo hambúrguer?"})

            eco = ws_ana.receive_json()  # quem manda também recebe a própria mensagem de volta
            assert eco["evento"] == "mensagem"
            assert eco["dados"]["texto"] == "Alguém já experimentou o novo hambúrguer?"

            recebido = ws_lucas.receive_json()
            assert recebido["evento"] == "mensagem"
            assert recebido["dados"]["usuario_id"] == ana["id"]

    mensagens = db.execute(
        "SELECT texto, usuario_id FROM mesas_virtuais_mensagens WHERE mesa_virtual_id = %s", (mesa["id"],)
    ).fetchall()
    assert len(mensagens) == 1
    assert mensagens[0]["usuario_id"] == ana["id"]


def test_sinalizacao_webrtc_e_encaminhada_so_para_o_destinatario(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, ana = _registar_e_logar(client, "ana@teste.com", "Ana")
    token_lucas, lucas = _registar_e_logar(client, "lucas@teste.com", "Lucas")
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_lucas))

    with client.websocket_connect(f"/ws/mesas-virtuais/{mesa['id']}?token={token_ana}") as ws_ana:
        with client.websocket_connect(f"/ws/mesas-virtuais/{mesa['id']}?token={token_lucas}") as ws_lucas:
            ws_ana.send_json({"tipo": "sinal", "para": lucas["id"], "dados": {"tipo": "oferta", "sdp": "fake"}})
            recebido = ws_lucas.receive_json()
            assert recebido["evento"] == "sinal"
            assert recebido["dados"]["de"] == ana["id"]


# ── Denúncia e bloqueio ───────────────────────────────────────────────────────


def test_denunciar_participante(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, _ = _registar_e_logar(client, "ana@teste.com", "Ana")
    token_lucas, lucas = _registar_e_logar(client, "lucas@teste.com", "Lucas")
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_lucas))

    resposta = client.post(
        f"/api/mesas-virtuais/{mesa['id']}/denunciar",
        json={"denunciado_usuario_id": lucas["id"], "motivo": "spam"},
        headers=_cabecalho(token_ana),
    )
    assert resposta.status_code == 201

    denuncia = db.execute("SELECT * FROM mesas_virtuais_denuncias WHERE denunciado_id = %s", (lucas["id"],)).fetchone()
    assert denuncia is not None
    assert denuncia["status"] == "pendente"


def test_nao_pode_denunciar_a_si_mesmo(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, ana = _registar_e_logar(client)
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    resposta = client.post(
        f"/api/mesas-virtuais/{mesa['id']}/denunciar",
        json={"denunciado_usuario_id": ana["id"], "motivo": "teste"},
        headers=_cabecalho(token_ana),
    )
    assert resposta.status_code == 400


def test_bloquear_usuario_esconde_mensagens_no_historico(client, db):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, ana = _registar_e_logar(client, "ana@teste.com", "Ana")
    token_lucas, lucas = _registar_e_logar(client, "lucas@teste.com", "Lucas")
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_lucas))

    db.execute(
        "INSERT INTO mesas_virtuais_mensagens (mesa_virtual_id, usuario_id, texto) VALUES (%s, %s, %s)",
        (mesa["id"], lucas["id"], "mensagem do lucas"),
    )
    db.commit()

    resposta = client.post(
        "/api/mesas-virtuais/bloqueios", json={"bloqueado_usuario_id": lucas["id"]}, headers=_cabecalho(token_ana)
    )
    assert resposta.status_code == 201

    mensagens = client.get(f"/api/mesas-virtuais/{mesa['id']}/mensagens", headers=_cabecalho(token_ana)).json()
    assert all(m["usuario_id"] != lucas["id"] for m in mensagens)

    listagem = client.get("/api/mesas-virtuais/bloqueios/listar", headers=_cabecalho(token_ana)).json()
    assert any(b["usuario_id"] == lucas["id"] for b in listagem)

    resposta = client.delete(f"/api/mesas-virtuais/bloqueios/{lucas['id']}", headers=_cabecalho(token_ana))
    assert resposta.status_code == 204


# ── Moderação (admin) ─────────────────────────────────────────────────────────


def test_admin_ve_mesas_e_participantes(client, db, admin_ativo):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, ana = _registar_e_logar(client)
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))

    token_admin = client.post("/api/admin/auth/login", json=admin_ativo).json()["access_token"]
    resposta = client.get("/api/admin/mesas-virtuais", headers=_cabecalho(token_admin))
    assert resposta.status_code == 200
    mesa_admin = next(m for m in resposta.json() if m["id"] == mesa["id"])
    assert mesa_admin["participantes"][0]["usuario_id"] == ana["id"]
    assert mesa_admin["participantes"][0]["email"] == ana["email"]


def test_admin_remove_mensagem(client, db, admin_ativo):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, ana = _registar_e_logar(client)
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    mensagem = db.execute(
        "INSERT INTO mesas_virtuais_mensagens (mesa_virtual_id, usuario_id, texto) VALUES (%s, %s, %s) RETURNING id",
        (mesa["id"], ana["id"], "mensagem ofensiva"),
    ).fetchone()
    db.commit()

    token_admin = client.post("/api/admin/auth/login", json=admin_ativo).json()["access_token"]
    resposta = client.delete(f"/api/admin/mesas-virtuais/mensagens/{mensagem['id']}", headers=_cabecalho(token_admin))
    assert resposta.status_code == 204

    linha = db.execute("SELECT removida FROM mesas_virtuais_mensagens WHERE id = %s", (mensagem["id"],)).fetchone()
    assert linha["removida"] == 1


def test_admin_banir_usuario_remove_da_mesa_e_impede_novo_sentar(client, db, admin_ativo):
    mesa = _mesa_com_capacidade(db, 4)
    token_ana, ana = _registar_e_logar(client)
    client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))

    token_admin = client.post("/api/admin/auth/login", json=admin_ativo).json()["access_token"]
    resposta = client.post(f"/api/admin/mesas-virtuais/usuarios/{ana['id']}/banir", json={"motivo": "spam"}, headers=_cabecalho(token_admin))
    assert resposta.status_code == 201

    ainda_sentada = db.execute(
        "SELECT 1 FROM mesas_virtuais_participantes WHERE usuario_id = %s AND saiu_em IS NULL", (ana["id"],)
    ).fetchone()
    assert ainda_sentada is None

    resposta = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    assert resposta.status_code == 403

    resposta = client.delete(f"/api/admin/mesas-virtuais/usuarios/{ana['id']}/banir", headers=_cabecalho(token_admin))
    assert resposta.status_code == 204
    resposta = client.post(f"/api/mesas-virtuais/{mesa['id']}/sentar", json={}, headers=_cabecalho(token_ana))
    assert resposta.status_code == 200

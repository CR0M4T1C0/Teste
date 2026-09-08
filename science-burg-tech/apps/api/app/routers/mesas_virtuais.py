"""Network da Fome — mesas virtuais.

Este módulo é independente do sistema de mesas físicas (app/routers/mesas.py
+ tabela `mesas`): aqui ninguém tem QR code nem comanda, é só um lugar para
conversar por texto/voz com desconhecidos enquanto come. Ver
database/README.md e schema.sql (seção 11) para o desenho das tabelas.

Duas camadas de proteção contra duas pessoas ocupando o mesmo lugar ao
mesmo tempo:
  1. `SELECT ... FOR UPDATE` na linha da mesa, antes de contar os lugares
     livres — serializa dois "sentar" concorrentes na mesma mesa dentro de
     um único processo/pool de conexões.
  2. Índice único parcial no banco (`idx_lugar_ocupado_por_mesa`) — garante
     a regra mesmo que a API rode em mais de uma instância ao mesmo tempo,
     onde o lock em memória de uma instância não protegeria a outra.
"""

import asyncio
import time
from typing import Optional

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.auth_admin import get_admin_atual
from app.auth_cliente import autenticar_cliente_websocket, get_usuario_atual, get_usuario_opcional
from app.db import _conectar, get_db
from app.schemas import (
    BanirUsuarioIn,
    BloqueioIn,
    DenunciaAdminOut,
    DenunciaMesaVirtualIn,
    DenunciaStatusIn,
    EnviarMensagemMesaVirtualIn,
    LugarMesaVirtualOut,
    MensagemMesaVirtualOut,
    MesaVirtualAdminOut,
    MesaVirtualDetalheOut,
    MesaVirtualOut,
    ParticipanteAdminOut,
    ParticipanteMesaVirtualOut,
    SentarMesaVirtualIn,
    UsuarioBloqueadoOut,
)
from app.websocket import gerenciador_admin, gerenciador_mesas_virtuais

router = APIRouter(prefix="/mesas-virtuais", tags=["mesas-virtuais"])
admin_router = APIRouter(prefix="/admin/mesas-virtuais", tags=["admin-mesas-virtuais"])

# Canal reservado do WebSocket usado só para avisar o salão inteiro que a
# ocupação de alguma mesa mudou (não é uma mesa de verdade, não tem chat).
CANAL_SALAO = -1


# ── Limite de spam do chat ───────────────────────────────────────────────────
#
# Em memória, um processo só — mesmo raciocínio do app/limite_tentativas.py,
# mas com janela bem mais curta: aqui é para impedir flood numa conversa ao
# vivo, não bloquear tentativas de login. Passar do limite não bane
# ninguém, só descarta a mensagem (o remetente recebe um evento de erro só
# para ele, o resto da mesa nem fica sabendo que algo foi bloqueado).
_JANELA_SPAM_SEGUNDOS = 10.0
_MAXIMO_MENSAGENS_NA_JANELA = 8
_historico_mensagens: dict[int, list[float]] = {}


def _usuario_em_flood(usuario_id: int) -> bool:
    agora = time.monotonic()
    historico = [t for t in _historico_mensagens.get(usuario_id, []) if agora - t < _JANELA_SPAM_SEGUNDOS]
    historico.append(agora)
    _historico_mensagens[usuario_id] = historico
    return len(historico) > _MAXIMO_MENSAGENS_NA_JANELA


# Depois que alguém desconecta do WebSocket de uma mesa, esperamos um pouco
# antes de liberar o lugar de verdade — uma queda de wifi de alguns segundos
# não deveria tirar a pessoa da mesa. Só o botão "Sair da mesa" (ou a rota
# POST /sair) libera o lugar na hora; o WebSocket sozinho só libera depois
# da carência, e só se a pessoa não tiver voltado.
_CARENCIA_DESCONEXAO_SEGUNDOS = 45
_tarefas_carencia: dict[tuple[int, int], asyncio.Task] = {}


def _cancelar_carencia(mesa_virtual_id: int, usuario_id: int) -> None:
    tarefa = _tarefas_carencia.pop((mesa_virtual_id, usuario_id), None)
    if tarefa is not None:
        tarefa.cancel()


# ── Helpers de banco ──────────────────────────────────────────────────────────


def _mesa_ou_404(db: psycopg.Connection, mesa_virtual_id: int, travar: bool = False) -> dict:
    consulta = "SELECT * FROM mesas_virtuais WHERE id = %s AND ativa = 1"
    if travar:
        consulta += " FOR UPDATE"
    mesa = db.execute(consulta, (mesa_virtual_id,)).fetchone()
    if mesa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesa virtual não encontrada")
    return mesa


def _pedido_ativo_texto(db: psycopg.Connection, usuario_id: int) -> Optional[str]:
    """Monta o "🍔 Está comendo: X + Y" de um participante a partir do pedido
    mais recente que ele ainda não recebeu nem cancelou. Não expõe nada além
    dos nomes dos produtos — sem endereço, telefone ou valor."""
    pedido = db.execute(
        """
        SELECT id FROM pedidos
        WHERE usuario_id = %s AND status NOT IN ('entregue', 'cancelado')
        ORDER BY id DESC LIMIT 1
        """,
        (usuario_id,),
    ).fetchone()
    if pedido is None:
        return None
    itens = db.execute(
        "SELECT nome_produto FROM itens_pedido WHERE pedido_id = %s ORDER BY id", (pedido["id"],)
    ).fetchall()
    if not itens:
        return None
    return " + ".join(item["nome_produto"] for item in itens)


def _participantes_ativos(db: psycopg.Connection, mesa_virtual_id: int) -> list[dict]:
    return db.execute(
        """
        SELECT p.usuario_id, p.lugar_numero, p.entrou_em, u.nome, u.email
        FROM mesas_virtuais_participantes p
        JOIN usuarios u ON u.id = p.usuario_id
        WHERE p.mesa_virtual_id = %s AND p.saiu_em IS NULL
        ORDER BY p.lugar_numero
        """,
        (mesa_virtual_id,),
    ).fetchall()


def _participante_out(db: psycopg.Connection, linha: dict) -> ParticipanteMesaVirtualOut:
    return ParticipanteMesaVirtualOut(
        usuario_id=linha["usuario_id"],
        nome=linha["nome"],
        lugar_numero=linha["lugar_numero"],
        comendo=_pedido_ativo_texto(db, linha["usuario_id"]),
        entrou_em=linha["entrou_em"],
    )


def _mesa_out(db: psycopg.Connection, mesa: dict) -> MesaVirtualOut:
    participantes = [_participante_out(db, linha) for linha in _participantes_ativos(db, mesa["id"])]
    ocupados = len(participantes)
    return MesaVirtualOut(
        id=mesa["id"],
        nome=mesa["nome"],
        capacidade=mesa["capacidade"],
        tema=mesa["tema"],
        lugares_ocupados=ocupados,
        lugares_disponiveis=mesa["capacidade"] - ocupados,
        cheia=ocupados >= mesa["capacidade"],
        participantes=participantes,
    )


def _mesa_detalhe_out(db: psycopg.Connection, mesa: dict, usuario_id: Optional[int]) -> MesaVirtualDetalheOut:
    participantes = {linha["lugar_numero"]: _participante_out(db, linha) for linha in _participantes_ativos(db, mesa["id"])}
    lugares = [
        LugarMesaVirtualOut(numero=numero, participante=participantes.get(numero))
        for numero in range(1, mesa["capacidade"] + 1)
    ]
    meu_lugar = next((l.numero for l in lugares if l.participante and l.participante.usuario_id == usuario_id), None)
    return MesaVirtualDetalheOut(id=mesa["id"], nome=mesa["nome"], capacidade=mesa["capacidade"], tema=mesa["tema"], lugares=lugares, meu_lugar=meu_lugar)


def _lugar_atual_do_usuario(db: psycopg.Connection, usuario_id: int) -> Optional[dict]:
    return db.execute(
        "SELECT * FROM mesas_virtuais_participantes WHERE usuario_id = %s AND saiu_em IS NULL",
        (usuario_id,),
    ).fetchone()


def _esta_banido(db: psycopg.Connection, usuario_id: int) -> bool:
    return db.execute("SELECT 1 FROM mesas_virtuais_banidos WHERE usuario_id = %s", (usuario_id,)).fetchone() is not None


def _ids_bloqueados_por(db: psycopg.Connection, usuario_id: int) -> set[int]:
    linhas = db.execute("SELECT bloqueado_id FROM mesas_virtuais_bloqueios WHERE usuario_id = %s", (usuario_id,)).fetchall()
    return {linha["bloqueado_id"] for linha in linhas}


def _mapa_bloqueios_da_mesa(db: psycopg.Connection, mesa_virtual_id: int) -> dict[int, set[int]]:
    """{usuario_id de cada conexão aberta na mesa -> conjunto de quem essa
    pessoa bloqueou}, usado para não entregar uma mensagem a quem bloqueou o
    autor dela (ver GerenciadorConexoesMesasVirtuais.broadcast)."""
    return {uid: _ids_bloqueados_por(db, uid) for uid in gerenciador_mesas_virtuais.usuarios_conectados(mesa_virtual_id)}


async def _sair_da_mesa(db: psycopg.Connection, participante: dict) -> None:
    db.execute(
        "UPDATE mesas_virtuais_participantes SET saiu_em = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = %s",
        (participante["id"],),
    )
    db.commit()
    mesa_virtual_id = participante["mesa_virtual_id"]
    usuario_id = participante["usuario_id"]
    await gerenciador_mesas_virtuais.broadcast(mesa_virtual_id, "participante_saiu", {"usuario_id": usuario_id, "lugar_numero": participante["lugar_numero"]})
    await gerenciador_mesas_virtuais.broadcast(CANAL_SALAO, "mesa_atualizada", {"mesa_virtual_id": mesa_virtual_id})


# ── Rotas do cliente ──────────────────────────────────────────────────────────


@router.get("", response_model=list[MesaVirtualOut])
def listar_mesas(
    tema: Optional[str] = Query(default=None),
    db: psycopg.Connection = Depends(get_db),
) -> list[MesaVirtualOut]:
    if tema:
        mesas = db.execute("SELECT * FROM mesas_virtuais WHERE ativa = 1 AND tema = %s ORDER BY id", (tema,)).fetchall()
    else:
        mesas = db.execute("SELECT * FROM mesas_virtuais WHERE ativa = 1 ORDER BY id").fetchall()
    return [_mesa_out(db, mesa) for mesa in mesas]


@router.get("/minha-mesa", response_model=Optional[MesaVirtualDetalheOut])
def minha_mesa_atual(
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
):
    """Onde o usuário logado está sentado agora, se estiver — usado ao
    recarregar a página para voltar direto para dentro da mesa."""
    participante = _lugar_atual_do_usuario(db, usuario["id"])
    if participante is None:
        return None
    mesa = _mesa_ou_404(db, participante["mesa_virtual_id"])
    return _mesa_detalhe_out(db, mesa, usuario["id"])


@router.get("/{mesa_virtual_id}", response_model=MesaVirtualDetalheOut)
def obter_mesa(
    mesa_virtual_id: int,
    usuario: Optional[dict] = Depends(get_usuario_opcional),
    db: psycopg.Connection = Depends(get_db),
) -> MesaVirtualDetalheOut:
    mesa = _mesa_ou_404(db, mesa_virtual_id)
    return _mesa_detalhe_out(db, mesa, usuario["id"] if usuario else None)


@router.post("/{mesa_virtual_id}/sentar", response_model=MesaVirtualDetalheOut)
async def sentar(
    mesa_virtual_id: int,
    dados: SentarMesaVirtualIn,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> MesaVirtualDetalheOut:
    if _esta_banido(db, usuario["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você está temporariamente impedido de usar o Network da Fome")

    mesa = _mesa_ou_404(db, mesa_virtual_id, travar=True)  # trava a linha: serializa "sentar" concorrentes nesta mesa

    atual = _lugar_atual_do_usuario(db, usuario["id"])
    if atual and atual["mesa_virtual_id"] == mesa_virtual_id:
        return _mesa_detalhe_out(db, mesa, usuario["id"])
    if atual:
        # Só se pode estar sentado em uma mesa por vez — levanta da mesa
        # anterior automaticamente antes de sentar nesta.
        await _sair_da_mesa(db, atual)

    ocupados = {
        linha["lugar_numero"]
        for linha in db.execute(
            "SELECT lugar_numero FROM mesas_virtuais_participantes WHERE mesa_virtual_id = %s AND saiu_em IS NULL",
            (mesa_virtual_id,),
        ).fetchall()
    }

    if dados.lugar_numero is not None:
        if dados.lugar_numero > mesa["capacidade"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este lugar não existe nesta mesa")
        if dados.lugar_numero in ocupados:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este lugar já está ocupado")
        lugar_numero = dados.lugar_numero
    else:
        livre = next((n for n in range(1, mesa["capacidade"] + 1) if n not in ocupados), None)
        if livre is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esta mesa está lotada")
        lugar_numero = livre

    try:
        db.execute(
            "INSERT INTO mesas_virtuais_participantes (mesa_virtual_id, usuario_id, lugar_numero) VALUES (%s, %s, %s)",
            (mesa_virtual_id, usuario["id"], lugar_numero),
        )
        db.commit()
    except psycopg.errors.UniqueViolation:
        # Segunda linha de defesa (ver docstring do módulo) — só deveria
        # disparar em corridas entre instâncias diferentes da API.
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este lugar acabou de ser ocupado, escolha outro")

    _cancelar_carencia(mesa_virtual_id, usuario["id"])

    detalhe = _mesa_detalhe_out(db, mesa, usuario["id"])
    participante_out = next(l.participante for l in detalhe.lugares if l.numero == lugar_numero)
    await gerenciador_mesas_virtuais.broadcast(mesa_virtual_id, "participante_sentou", participante_out.model_dump())
    await gerenciador_mesas_virtuais.broadcast(CANAL_SALAO, "mesa_atualizada", {"mesa_virtual_id": mesa_virtual_id})
    return detalhe


@router.post("/{mesa_virtual_id}/sair", status_code=status.HTTP_204_NO_CONTENT)
async def sair(
    mesa_virtual_id: int,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> None:
    participante = _lugar_atual_do_usuario(db, usuario["id"])
    if participante is None or participante["mesa_virtual_id"] != mesa_virtual_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Você não está sentado nesta mesa")
    await _sair_da_mesa(db, participante)


@router.get("/{mesa_virtual_id}/mensagens", response_model=list[MensagemMesaVirtualOut])
def listar_mensagens(
    mesa_virtual_id: int,
    limite: int = Query(default=50, ge=1, le=200),
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[MensagemMesaVirtualOut]:
    """Histórico recente do chat — só quem está sentado na mesa pode ver,
    para não virar uma sala pública de leitura para quem nem está nela."""
    participante = _lugar_atual_do_usuario(db, usuario["id"])
    if participante is None or participante["mesa_virtual_id"] != mesa_virtual_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sente-se nesta mesa para ver o chat")

    bloqueados = _ids_bloqueados_por(db, usuario["id"])
    linhas = db.execute(
        """
        SELECT m.id, m.mesa_virtual_id, m.usuario_id, u.nome, m.texto, m.criado_em
        FROM mesas_virtuais_mensagens m
        JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.mesa_virtual_id = %s AND m.removida = 0
        ORDER BY m.id DESC LIMIT %s
        """,
        (mesa_virtual_id, limite),
    ).fetchall()
    linhas.reverse()
    return [MensagemMesaVirtualOut(**linha) for linha in linhas if linha["usuario_id"] not in bloqueados]


@router.post("/{mesa_virtual_id}/denunciar", status_code=status.HTTP_201_CREATED)
async def denunciar(
    mesa_virtual_id: int,
    dados: DenunciaMesaVirtualIn,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> dict:
    if dados.denunciado_usuario_id == usuario["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não é possível denunciar a si mesmo")

    denunciado = db.execute("SELECT nome FROM usuarios WHERE id = %s", (dados.denunciado_usuario_id,)).fetchone()
    if denunciado is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário denunciado não encontrado")

    db.execute(
        """
        INSERT INTO mesas_virtuais_denuncias (mesa_virtual_id, denunciante_id, denunciado_id, motivo, mensagem_id)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (mesa_virtual_id, usuario["id"], dados.denunciado_usuario_id, dados.motivo, dados.mensagem_id),
    )
    db.commit()

    await gerenciador_admin.broadcast(
        "denuncia_mesa_virtual",
        {"mesa_virtual_id": mesa_virtual_id, "denunciado_nome": denunciado["nome"]},
    )
    return {"mensagem": "Denúncia registrada. A equipe vai avaliar."}


@router.get("/bloqueios/listar", response_model=list[UsuarioBloqueadoOut])
def listar_bloqueios(
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[UsuarioBloqueadoOut]:
    linhas = db.execute(
        """
        SELECT u.id AS usuario_id, u.nome FROM mesas_virtuais_bloqueios b
        JOIN usuarios u ON u.id = b.bloqueado_id
        WHERE b.usuario_id = %s ORDER BY u.nome
        """,
        (usuario["id"],),
    ).fetchall()
    return [UsuarioBloqueadoOut(**linha) for linha in linhas]


@router.post("/bloqueios", status_code=status.HTTP_201_CREATED)
def bloquear_usuario(
    dados: BloqueioIn,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> dict:
    if dados.bloqueado_usuario_id == usuario["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não é possível bloquear a si mesmo")
    db.execute(
        "INSERT INTO mesas_virtuais_bloqueios (usuario_id, bloqueado_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (usuario["id"], dados.bloqueado_usuario_id),
    )
    db.commit()
    return {"mensagem": "Usuário bloqueado. Você não verá mais mensagens dele."}


@router.delete("/bloqueios/{bloqueado_usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def desbloquear_usuario(
    bloqueado_usuario_id: int,
    usuario: dict = Depends(get_usuario_atual),
    db: psycopg.Connection = Depends(get_db),
) -> None:
    db.execute(
        "DELETE FROM mesas_virtuais_bloqueios WHERE usuario_id = %s AND bloqueado_id = %s",
        (usuario["id"], bloqueado_usuario_id),
    )
    db.commit()


# ── WebSocket do salão (só ocupação, sem login) ─────────────────────────────


async def websocket_salao(websocket: WebSocket) -> None:
    """Feed público e somente-leitura: avisa a tela do salão para atualizar
    a ocupação de uma mesa sem precisar dar F5. Não exige login (o salão é
    visível antes de entrar em qualquer mesa) e não carrega chat nenhum."""
    await gerenciador_mesas_virtuais.conectar(CANAL_SALAO, 0, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        gerenciador_mesas_virtuais.desconectar(CANAL_SALAO, websocket)


# ── WebSocket de dentro de uma mesa (chat + sinalização de voz) ─────────────


async def _liberar_apos_carencia(mesa_virtual_id: int, usuario_id: int) -> None:
    try:
        await asyncio.sleep(_CARENCIA_DESCONEXAO_SEGUNDOS)
    except asyncio.CancelledError:
        return
    # Se a pessoa já reconectou, não libera o lugar.
    if usuario_id in gerenciador_mesas_virtuais.usuarios_conectados(mesa_virtual_id):
        return
    conn = _conectar()
    try:
        participante = conn.execute(
            "SELECT * FROM mesas_virtuais_participantes WHERE usuario_id = %s AND mesa_virtual_id = %s AND saiu_em IS NULL",
            (usuario_id, mesa_virtual_id),
        ).fetchone()
        if participante is not None:
            await _sair_da_mesa(conn, participante)
    finally:
        conn.close()
        _tarefas_carencia.pop((mesa_virtual_id, usuario_id), None)


async def websocket_mesa(websocket: WebSocket, mesa_virtual_id: int, token: str = "") -> None:
    conn = _conectar()
    try:
        usuario = autenticar_cliente_websocket(token, conn)
        if usuario is None:
            await websocket.close(code=4401)
            return
        if _esta_banido(conn, usuario["id"]):
            await websocket.close(code=4403)
            return
        participante = conn.execute(
            "SELECT * FROM mesas_virtuais_participantes WHERE usuario_id = %s AND mesa_virtual_id = %s AND saiu_em IS NULL",
            (usuario["id"], mesa_virtual_id),
        ).fetchone()
        if participante is None:
            # Não deixa "escutar" o chat de uma mesa sem estar sentado nela.
            await websocket.close(code=4403)
            return
    finally:
        conn.close()

    _cancelar_carencia(mesa_virtual_id, usuario["id"])
    await gerenciador_mesas_virtuais.conectar(mesa_virtual_id, usuario["id"], websocket)

    try:
        while True:
            bruto = await websocket.receive_json()
            tipo = bruto.get("tipo")

            if tipo == "chat":
                texto = (bruto.get("texto") or "").strip()
                if not texto or len(texto) > 500:
                    continue
                if _usuario_em_flood(usuario["id"]):
                    await websocket.send_json({"evento": "erro", "dados": {"mensagem": "Você está enviando mensagens rápido demais. Espere um instante."}})
                    continue

                # Conexão avulsa (mesmo padrão da autenticação no handshake
                # deste WebSocket, acima): simples e correta, e evita
                # depender do pool de requisições HTTP dentro de uma conexão
                # de longa duração como esta.
                db = _conectar()
                try:
                    linha = db.execute(
                        "INSERT INTO mesas_virtuais_mensagens (mesa_virtual_id, usuario_id, texto) VALUES (%s, %s, %s) RETURNING id, criado_em",
                        (mesa_virtual_id, usuario["id"], texto),
                    ).fetchone()
                    db.commit()
                    mapa_bloqueios = _mapa_bloqueios_da_mesa(db, mesa_virtual_id)
                finally:
                    db.close()

                mensagem_out = MensagemMesaVirtualOut(
                    id=linha["id"], mesa_virtual_id=mesa_virtual_id, usuario_id=usuario["id"],
                    nome=usuario["nome"], texto=texto, criado_em=linha["criado_em"],
                )
                await gerenciador_mesas_virtuais.broadcast(mesa_virtual_id, "mensagem", mensagem_out.model_dump(), ignorar_bloqueio_de=mapa_bloqueios)

            elif tipo == "sinal":
                # Sinalização WebRTC (oferta/resposta/candidatos ICE) — a API
                # só repassa para o destinatário certo, nunca olha o conteúdo.
                destino = bruto.get("para")
                if not isinstance(destino, int):
                    continue
                await gerenciador_mesas_virtuais.enviar_para_usuario(
                    mesa_virtual_id, destino, "sinal", {"de": usuario["id"], "nome": usuario["nome"], "dados": bruto.get("dados")}
                )

            # Qualquer outro "tipo" é ignorado — protocolo propositalmente
            # pequeno, sem comandos administrativos passando pelo WebSocket
            # do cliente.
    except WebSocketDisconnect:
        pass
    finally:
        gerenciador_mesas_virtuais.desconectar(mesa_virtual_id, websocket)
        # Não libera o lugar na hora — dá uma carência (ver constante no
        # topo do arquivo) para não punir uma queda de conexão momentânea.
        if usuario["id"] not in gerenciador_mesas_virtuais.usuarios_conectados(mesa_virtual_id):
            _tarefas_carencia[(mesa_virtual_id, usuario["id"])] = asyncio.create_task(
                _liberar_apos_carencia(mesa_virtual_id, usuario["id"])
            )


# ── Moderação (painel do dono) ────────────────────────────────────────────────


@admin_router.get("", response_model=list[MesaVirtualAdminOut])
def admin_listar_mesas(
    admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[MesaVirtualAdminOut]:
    mesas = db.execute("SELECT * FROM mesas_virtuais ORDER BY id").fetchall()
    saida = []
    for mesa in mesas:
        participantes = [
            ParticipanteAdminOut(
                usuario_id=linha["usuario_id"], nome=linha["nome"], email=linha["email"],
                lugar_numero=linha["lugar_numero"], comendo=_pedido_ativo_texto(db, linha["usuario_id"]),
                entrou_em=linha["entrou_em"],
            )
            for linha in _participantes_ativos(db, mesa["id"])
        ]
        saida.append(MesaVirtualAdminOut(id=mesa["id"], nome=mesa["nome"], capacidade=mesa["capacidade"], tema=mesa["tema"], ativa=bool(mesa["ativa"]), participantes=participantes))
    return saida


_CONSULTA_DENUNCIAS = """
    SELECT d.id, d.mesa_virtual_id, mv.nome AS mesa_virtual_nome,
           d.denunciante_id, ud.nome AS denunciante_nome,
           d.denunciado_id, ua.nome AS denunciado_nome,
           d.motivo, m.texto AS mensagem_texto, d.status, d.criado_em
    FROM mesas_virtuais_denuncias d
    JOIN mesas_virtuais mv ON mv.id = d.mesa_virtual_id
    JOIN usuarios ud ON ud.id = d.denunciante_id
    JOIN usuarios ua ON ua.id = d.denunciado_id
    LEFT JOIN mesas_virtuais_mensagens m ON m.id = d.mensagem_id
"""


@admin_router.get("/denuncias", response_model=list[DenunciaAdminOut])
def admin_listar_denuncias(
    status_filtro: Optional[str] = Query(default=None, alias="status"),
    admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[DenunciaAdminOut]:
    consulta = _CONSULTA_DENUNCIAS
    parametros: tuple = ()
    if status_filtro:
        consulta += " WHERE d.status = %s"
        parametros = (status_filtro,)
    consulta += " ORDER BY d.id DESC"
    linhas = db.execute(consulta, parametros).fetchall()
    return [DenunciaAdminOut(**linha) for linha in linhas]


@admin_router.patch("/denuncias/{denuncia_id}", response_model=DenunciaAdminOut)
def admin_marcar_denuncia(
    denuncia_id: int,
    dados: DenunciaStatusIn,
    admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> DenunciaAdminOut:
    existente = db.execute("SELECT id FROM mesas_virtuais_denuncias WHERE id = %s", (denuncia_id,)).fetchone()
    if existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Denúncia não encontrada")
    db.execute("UPDATE mesas_virtuais_denuncias SET status = %s WHERE id = %s", (dados.status, denuncia_id))
    db.commit()
    linha = db.execute(_CONSULTA_DENUNCIAS + " WHERE d.id = %s", (denuncia_id,)).fetchone()
    return DenunciaAdminOut(**linha)


@admin_router.delete("/mensagens/{mensagem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_remover_mensagem(
    mensagem_id: int,
    admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> None:
    mensagem = db.execute("SELECT * FROM mesas_virtuais_mensagens WHERE id = %s", (mensagem_id,)).fetchone()
    if mensagem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensagem não encontrada")
    db.execute(
        "UPDATE mesas_virtuais_mensagens SET removida = 1, removida_por_admin_id = %s WHERE id = %s",
        (admin["id"], mensagem_id),
    )
    db.commit()
    await gerenciador_mesas_virtuais.broadcast(mensagem["mesa_virtual_id"], "mensagem_removida", {"mensagem_id": mensagem_id})


@admin_router.post("/usuarios/{usuario_id}/banir", status_code=status.HTTP_201_CREATED)
async def admin_banir_usuario(
    usuario_id: int,
    dados: BanirUsuarioIn,
    admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> dict:
    usuario = db.execute("SELECT id FROM usuarios WHERE id = %s", (usuario_id,)).fetchone()
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")

    db.execute(
        """
        INSERT INTO mesas_virtuais_banidos (usuario_id, motivo, banido_por_id)
        VALUES (%s, %s, %s)
        ON CONFLICT (usuario_id) DO UPDATE SET motivo = EXCLUDED.motivo, banido_por_id = EXCLUDED.banido_por_id
        """,
        (usuario_id, dados.motivo, admin["id"]),
    )
    participante = _lugar_atual_do_usuario(db, usuario_id)
    if participante is not None:
        await _sair_da_mesa(db, participante)
        await gerenciador_mesas_virtuais.desconectar_usuario(participante["mesa_virtual_id"], usuario_id, "Você foi removido do Network da Fome pela equipe.")
    db.commit()
    return {"mensagem": "Usuário banido do recurso social."}


@admin_router.delete("/usuarios/{usuario_id}/banir", status_code=status.HTTP_204_NO_CONTENT)
def admin_desbanir_usuario(
    usuario_id: int,
    admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> None:
    db.execute("DELETE FROM mesas_virtuais_banidos WHERE usuario_id = %s", (usuario_id,))
    db.commit()

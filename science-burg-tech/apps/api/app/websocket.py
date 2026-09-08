import json
from typing import Any, Optional

from fastapi import WebSocket


class GerenciadorConexoesAdmin:
    """Mantém as conexões WebSocket dos administradores logados e faz o
    broadcast de eventos (pedido criado, status alterado, etc). Em memória
    mesmo — para o tamanho deste projeto não precisa de Redis nem fila
    externa (ver PROMPT_IMPLEMENTACAO.md).
    """

    def __init__(self) -> None:
        self._conexoes: list[WebSocket] = []

    async def conectar(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._conexoes.append(websocket)

    def desconectar(self, websocket: WebSocket) -> None:
        if websocket in self._conexoes:
            self._conexoes.remove(websocket)

    async def broadcast(self, evento: str, dados: Any) -> None:
        mensagem = json.dumps({"evento": evento, "dados": dados}, default=str, ensure_ascii=False)
        mortas: list[WebSocket] = []
        for conexao in self._conexoes:
            try:
                await conexao.send_text(mensagem)
            except Exception:
                mortas.append(conexao)
        for conexao in mortas:
            self.desconectar(conexao)


gerenciador_admin = GerenciadorConexoesAdmin()


class GerenciadorConexoesMesasVirtuais:
    """Conexões WebSocket do salão "Network da Fome", uma lista por mesa
    virtual. Assim como o gerenciador do admin, tudo em memória — cada
    processo da API só precisa saber das conexões que ele mesmo aceitou (ver
    limitação equivalente documentada em GerenciadorConexoesAdmin).

    Guardamos o usuario_id ao lado de cada WebSocket porque duas coisas
    dependem de saber "de quem" é cada conexão sem consultar o banco de
    novo: (1) filtrar mensagens de quem o destinatário bloqueou, e (2)
    encaminhar sinalização de voz (WebRTC) para uma pessoa específica da
    mesa, não para todo mundo.
    """

    def __init__(self) -> None:
        self._conexoes: dict[int, list[tuple[WebSocket, int]]] = {}

    async def conectar(self, mesa_virtual_id: int, usuario_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._conexoes.setdefault(mesa_virtual_id, []).append((websocket, usuario_id))

    def desconectar(self, mesa_virtual_id: int, websocket: WebSocket) -> None:
        conexoes = self._conexoes.get(mesa_virtual_id)
        if not conexoes:
            return
        self._conexoes[mesa_virtual_id] = [c for c in conexoes if c[0] is not websocket]
        if not self._conexoes[mesa_virtual_id]:
            self._conexoes.pop(mesa_virtual_id, None)

    def usuarios_conectados(self, mesa_virtual_id: int) -> set[int]:
        return {usuario_id for _, usuario_id in self._conexoes.get(mesa_virtual_id, [])}

    async def broadcast(
        self,
        mesa_virtual_id: int,
        evento: str,
        dados: Any,
        ignorar_bloqueio_de: Optional[dict[int, set[int]]] = None,
    ) -> None:
        """Envia um evento para todo mundo conectado na mesa.

        `ignorar_bloqueio_de`, quando informado, é um mapa
        {usuario_id_da_conexao: {ids que essa pessoa bloqueou}} — quem
        bloqueou o autor da mensagem simplesmente não recebe o evento. Usado
        só no evento de chat; presença/lugar continuam visíveis para todos
        (bloquear alguém não esconde que a pessoa está na mesa, só as
        mensagens dela).
        """
        mensagem = json.dumps({"evento": evento, "dados": dados}, default=str, ensure_ascii=False)
        mortas: list[WebSocket] = []
        for conexao, usuario_id in self._conexoes.get(mesa_virtual_id, []):
            if ignorar_bloqueio_de and usuario_id in ignorar_bloqueio_de:
                autor_id = dados.get("usuario_id") if isinstance(dados, dict) else None
                if autor_id in ignorar_bloqueio_de[usuario_id]:
                    continue
            try:
                await conexao.send_text(mensagem)
            except Exception:
                mortas.append(conexao)
        for conexao in mortas:
            self.desconectar(mesa_virtual_id, conexao)

    async def enviar_para_usuario(self, mesa_virtual_id: int, usuario_id_destino: int, evento: str, dados: Any) -> None:
        """Encaminha um evento só para as conexões de uma pessoa específica
        na mesa — é como a sinalização WebRTC (oferta/resposta/ICE) viaja
        entre dois participantes sem que o resto da mesa veja."""
        mensagem = json.dumps({"evento": evento, "dados": dados}, default=str, ensure_ascii=False)
        for conexao, usuario_id in self._conexoes.get(mesa_virtual_id, []):
            if usuario_id != usuario_id_destino:
                continue
            try:
                await conexao.send_text(mensagem)
            except Exception:
                self.desconectar(mesa_virtual_id, conexao)

    async def desconectar_usuario(self, mesa_virtual_id: int, usuario_id: int, motivo: str) -> None:
        """Fecha à força as conexões de uma pessoa numa mesa — usado quando a
        moderação bane alguém do recurso social enquanto ela está online."""
        conexoes = [c for c, uid in self._conexoes.get(mesa_virtual_id, []) if uid == usuario_id]
        for conexao in conexoes:
            try:
                await conexao.send_text(json.dumps({"evento": "removido", "dados": {"motivo": motivo}}, ensure_ascii=False))
                await conexao.close(code=4403)
            except Exception:
                pass
            self.desconectar(mesa_virtual_id, conexao)


gerenciador_mesas_virtuais = GerenciadorConexoesMesasVirtuais()

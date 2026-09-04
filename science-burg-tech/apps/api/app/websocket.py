import json
from typing import Any

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

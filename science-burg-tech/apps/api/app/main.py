from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth_admin import autenticar_admin_websocket
from app.config import CORS_ORIGINS, UPLOADS_DIR
from app.db import _conectar, abrir_pool, fechar_pool, inicializar_banco
from app.routers import (
    admin,
    auth,
    avaliacoes,
    cardapio,
    combos,
    cupons,
    enderecos,
    gpt,
    mesas,
    mesas_virtuais,
    pedidos,
    promocoes,
    relatorios,
)
from app.websocket import gerenciador_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    inicializar_banco()
    abrir_pool()
    yield
    fechar_pool()


app = FastAPI(title="Burger Tech API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Fotos de produtos enviadas pelo painel admin (POST /api/admin/upload-imagem)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(cardapio.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(pedidos.router, prefix="/api")
app.include_router(enderecos.router, prefix="/api")
app.include_router(mesas.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(relatorios.router, prefix="/api")
app.include_router(cupons.router, prefix="/api")
app.include_router(promocoes.router, prefix="/api")
app.include_router(combos.router, prefix="/api")
app.include_router(avaliacoes.router, prefix="/api")
app.include_router(mesas_virtuais.router, prefix="/api")
app.include_router(mesas_virtuais.admin_router, prefix="/api")
app.include_router(gpt.router, prefix="/api")


@app.get("/api/saude")
def saude() -> dict:
    return {"status": "ok"}


@app.websocket("/ws/admin")
async def websocket_admin(websocket: WebSocket, token: str = "") -> None:
    db = _conectar()
    try:
        admin_autenticado = autenticar_admin_websocket(token, db)
    finally:
        db.close()

    if admin_autenticado is None:
        await websocket.close(code=4401)
        return

    await gerenciador_admin.conectar(websocket)
    try:
        while True:
            # Não esperamos mensagens do cliente, só mantemos a conexão viva;
            # se o navegador fechar a aba, o receive_text() levanta o disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        gerenciador_admin.desconectar(websocket)


# ── "Network da Fome" (mesas virtuais) ────────────────────────────────────


@app.websocket("/ws/mesas-virtuais/salao")
async def ws_mesas_virtuais_salao(websocket: WebSocket) -> None:
    await mesas_virtuais.websocket_salao(websocket)


@app.websocket("/ws/mesas-virtuais/{mesa_virtual_id}")
async def ws_mesa_virtual(websocket: WebSocket, mesa_virtual_id: int, token: str = "") -> None:
    await mesas_virtuais.websocket_mesa(websocket, mesa_virtual_id, token)

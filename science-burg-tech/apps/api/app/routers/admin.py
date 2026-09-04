import secrets
from datetime import datetime, timezone
from typing import Optional

import psycopg
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.auth_admin import criar_token_admin, exigir_papel_admin, get_admin_atual
from app.auth_cliente import gastar_tempo_de_verificacao, verificar_senha
from app.config import UPLOADS_PRODUTOS_DIR
from app.db import get_db
from app.limite_tentativas import registrar_falha, registrar_sucesso, segundos_de_bloqueio
from app.routers.mesas import _montar_comanda_out
from app.routers.pedidos import _linha_para_pedido
from app.schemas import (
    AdminLoginIn,
    AdministradorOut,
    AdminTokenOut,
    FecharComandaIn,
    ImagemUploadOut,
    MesaAdminOut,
    MesaOut,
    PedidoAdminOut,
    PedidoStatusIn,
    ProdutoCreateIn,
    ProdutoOut,
    ProdutoUpdateIn,
)
from app.routers.cardapio import _linha_para_produto
from app.websocket import gerenciador_admin

EXTENSOES_IMAGEM_PERMITIDAS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024  # 5 MB

# "Assinaturas" (magic bytes) que todo arquivo do formato tem no começo. O
# content-type do upload é informado pelo próprio navegador/cliente, então
# dá para mentir: alguém poderia enviar um .html ou um script dizendo que é
# "image/png". Conferir os primeiros bytes garante que o arquivo é mesmo
# uma imagem antes de gravá-lo numa pasta servida publicamente.
_ASSINATURAS_IMAGEM: dict[str, tuple[bytes, ...]] = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/gif": (b"GIF87a", b"GIF89a"),
    "image/webp": (b"RIFF",),  # RIFF....WEBP — o "WEBP" é conferido à parte
}

# Colunas de "produtos" que o endpoint PATCH pode alterar.
COLUNAS_PRODUTO_EDITAVEIS = {
    "categoria_id",
    "nome",
    "slug",
    "descricao",
    "preco",
    "calorias",
    "imagem_url",
    "tag",
    "cor_badge",
    "disponivel",
}


def _conteudo_bate_com_tipo(conteudo: bytes, content_type: str) -> bool:
    assinaturas = _ASSINATURAS_IMAGEM.get(content_type, ())
    if not any(conteudo.startswith(a) for a in assinaturas):
        return False
    if content_type == "image/webp":
        # No WebP, os bytes 8..12 precisam ser exatamente "WEBP".
        return len(conteudo) >= 12 and conteudo[8:12] == b"WEBP"
    return True


router = APIRouter(prefix="/admin", tags=["administração"])


def _linha_para_admin(linha: dict) -> AdministradorOut:
    return AdministradorOut(id=linha["id"], nome=linha["nome"], email=linha["email"], papel=linha["papel"])


def _chave_limite_admin(request: Request, email: str) -> str:
    ip = request.client.host if request.client else "desconhecido"
    return f"admin:{ip}:{email.lower()}"


@router.post("/auth/login", response_model=AdminTokenOut)
def login_admin(dados: AdminLoginIn, request: Request, db: psycopg.Connection = Depends(get_db)) -> AdminTokenOut:
    chave = _chave_limite_admin(request, dados.email)

    bloqueado_por = segundos_de_bloqueio(chave)
    if bloqueado_por:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Muitas tentativas de login. Tente novamente em {bloqueado_por // 60 + 1} minuto(s).",
            headers={"Retry-After": str(bloqueado_por)},
        )

    admin = db.execute(
        "SELECT * FROM administradores WHERE email = %s AND ativo = 1", (dados.email,)
    ).fetchone()

    if admin is None:
        gastar_tempo_de_verificacao()
        registrar_falha(chave)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos")

    if not verificar_senha(dados.senha, admin["senha_hash"]):
        registrar_falha(chave)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos")

    registrar_sucesso(chave)
    token = criar_token_admin(admin["id"], admin["email"], admin["papel"])
    return AdminTokenOut(access_token=token, administrador=_linha_para_admin(admin))


@router.get("/auth/me", response_model=AdministradorOut)
def admin_atual(admin: dict = Depends(get_admin_atual)) -> AdministradorOut:
    return _linha_para_admin(admin)


# ── Pedidos ──────────────────────────────────────────────────────────────────


@router.get("/pedidos", response_model=list[PedidoAdminOut])
def listar_pedidos_admin(
    tipo: Optional[str] = None,
    status_filtro: Optional[str] = None,
    _admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[PedidoAdminOut]:
    sql = """
        SELECT p.*, u.nome AS usuario_nome, m.numero AS mesa_numero
        FROM pedidos p
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN comandas c ON c.id = p.comanda_id
        LEFT JOIN mesas m ON m.id = c.mesa_id
        WHERE 1 = 1
    """
    parametros: list[str] = []
    if tipo:
        sql += " AND p.tipo = %s"
        parametros.append(tipo)
    if status_filtro:
        sql += " AND p.status = %s"
        parametros.append(status_filtro)
    sql += " ORDER BY p.criado_em DESC"

    linhas = db.execute(sql, parametros).fetchall()
    resultado = []
    for linha in linhas:
        base = _linha_para_pedido(db, linha)
        resultado.append(
            PedidoAdminOut(**base.model_dump(), usuario_nome=linha["usuario_nome"], mesa_numero=linha["mesa_numero"])
        )
    return resultado


@router.patch("/pedidos/{pedido_id}/status", response_model=PedidoAdminOut)
async def alterar_status_pedido(
    pedido_id: int,
    dados: PedidoStatusIn,
    _admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> PedidoAdminOut:
    linha = db.execute(
        """
        SELECT p.*, u.nome AS usuario_nome, m.numero AS mesa_numero
        FROM pedidos p
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN comandas c ON c.id = p.comanda_id
        LEFT JOIN mesas m ON m.id = c.mesa_id
        WHERE p.id = %s
        """,
        (pedido_id,),
    ).fetchone()
    if linha is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado")

    db.execute("UPDATE pedidos SET status = %s WHERE id = %s", (dados.status, pedido_id))
    db.commit()

    linha = db.execute(
        """
        SELECT p.*, u.nome AS usuario_nome, m.numero AS mesa_numero
        FROM pedidos p
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN comandas c ON c.id = p.comanda_id
        LEFT JOIN mesas m ON m.id = c.mesa_id
        WHERE p.id = %s
        """,
        (pedido_id,),
    ).fetchone()
    base = _linha_para_pedido(db, linha)
    pedido_out = PedidoAdminOut(**base.model_dump(), usuario_nome=linha["usuario_nome"], mesa_numero=linha["mesa_numero"])

    await gerenciador_admin.broadcast("pedido_status_alterado", pedido_out.model_dump())
    return pedido_out


# Estados que ainda interessam à cozinha — depois de "pronto" o pedido saiu
# das mãos de quem prepara (foi entregue, saiu para entrega, ou foi
# cancelado), então some da tela.
_STATUS_ATIVOS_NA_COZINHA = ("pendente", "confirmado", "em_preparo", "pronto")


@router.get("/cozinha", response_model=list[PedidoAdminOut])
def listar_pedidos_cozinha(
    _admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[PedidoAdminOut]:
    """Fila da cozinha: pedidos de mesa, entrega e retirada juntos — quem
    prepara não separa por canal, separa por "já comecei ou não"."""
    marcadores = ", ".join(["%s"] * len(_STATUS_ATIVOS_NA_COZINHA))
    linhas = db.execute(
        f"""
        SELECT p.*, u.nome AS usuario_nome, m.numero AS mesa_numero
        FROM pedidos p
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN comandas c ON c.id = p.comanda_id
        LEFT JOIN mesas m ON m.id = c.mesa_id
        WHERE p.status IN ({marcadores})
        ORDER BY p.criado_em ASC
        """,
        _STATUS_ATIVOS_NA_COZINHA,
    ).fetchall()

    resultado = []
    for linha in linhas:
        base = _linha_para_pedido(db, linha)
        resultado.append(
            PedidoAdminOut(**base.model_dump(), usuario_nome=linha["usuario_nome"], mesa_numero=linha["mesa_numero"])
        )
    return resultado


# ── Mesas e comandas ─────────────────────────────────────────────────────────


@router.get("/mesas", response_model=list[MesaAdminOut])
def listar_mesas_admin(
    _admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[MesaAdminOut]:
    mesas = db.execute("SELECT * FROM mesas ORDER BY numero").fetchall()
    resultado = []
    for mesa in mesas:
        comanda = db.execute(
            "SELECT * FROM comandas WHERE mesa_id = %s AND status = 'aberta'", (mesa["id"],)
        ).fetchone()
        comanda_out = _montar_comanda_out(db, comanda) if comanda else None
        resultado.append(
            MesaAdminOut(
                mesa=MesaOut(id=mesa["id"], numero=mesa["numero"], capacidade=mesa["capacidade"], status=mesa["status"]),
                comanda=comanda_out,
            )
        )
    return resultado


@router.patch("/comandas/{comanda_id}/fechar", status_code=status.HTTP_200_OK)
async def fechar_comanda(
    comanda_id: int,
    dados: FecharComandaIn,
    admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> dict:
    comanda = db.execute("SELECT * FROM comandas WHERE id = %s AND status = 'aberta'", (comanda_id,)).fetchone()
    if comanda is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comanda não encontrada ou já fechada")

    comanda_out = _montar_comanda_out(db, comanda)
    if comanda_out.total <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Não é possível fechar uma comanda sem nenhum pedido")

    agora = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        """
        INSERT INTO pagamentos (comanda_id, metodo, status, valor, pago_em)
        VALUES (%s, %s, 'aprovado', %s, %s)
        """,
        (comanda_id, dados.metodo, comanda_out.total, agora),
    )
    # O trigger trg_comanda_encerrada_libera_mesa cuida de liberar a mesa
    # automaticamente assim que o status vira 'paga'.
    db.execute("UPDATE comandas SET status = 'paga', fechada_em = %s WHERE id = %s", (agora, comanda_id))
    db.commit()

    mesa = db.execute(
        "SELECT m.* FROM mesas m JOIN comandas c ON c.mesa_id = m.id WHERE c.id = %s", (comanda_id,)
    ).fetchone()

    await gerenciador_admin.broadcast(
        "comanda_fechada", {"comanda_id": comanda_id, "mesa_numero": mesa["numero"], "total": comanda_out.total}
    )
    await gerenciador_admin.broadcast(
        "mesa_status_alterado", {"mesa_numero": mesa["numero"], "status": "livre"}
    )

    return {"mensagem": "Comanda fechada e pagamento registrado", "total": comanda_out.total}


# ── Cardápio (CRUD simples) ──────────────────────────────────────────────────


@router.post("/upload-imagem", response_model=ImagemUploadOut)
async def upload_imagem(
    file: UploadFile = File(...),
    _admin: dict = Depends(exigir_papel_admin),
) -> ImagemUploadOut:
    extensao = EXTENSOES_IMAGEM_PERMITIDAS.get(file.content_type or "")
    if extensao is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie uma imagem JPEG, PNG, WEBP ou GIF",
        )

    # Lê 1 byte a mais que o limite: se vier esse byte extra, já sabemos que
    # o arquivo passou do tamanho, sem precisar montar o bytes inteiro na
    # mão para só então medir.
    conteudo = await file.read(TAMANHO_MAXIMO_IMAGEM + 1)
    if len(conteudo) > TAMANHO_MAXIMO_IMAGEM:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Imagem muito grande (máximo 5 MB)")
    if not conteudo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio")

    if not _conteudo_bate_com_tipo(conteudo, file.content_type or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo enviado não é uma imagem válida do tipo informado",
        )

    UPLOADS_PRODUTOS_DIR.mkdir(parents=True, exist_ok=True)
    nome_arquivo = f"{secrets.token_urlsafe(12)}{extensao}"
    (UPLOADS_PRODUTOS_DIR / nome_arquivo).write_bytes(conteudo)

    return ImagemUploadOut(url=f"/uploads/produtos/{nome_arquivo}")


@router.get("/produtos", response_model=list[ProdutoOut])
def listar_produtos_admin(
    _admin: dict = Depends(get_admin_atual),
    db: psycopg.Connection = Depends(get_db),
) -> list[ProdutoOut]:
    linhas = db.execute(
        """
        SELECT p.*, c.slug AS categoria_slug FROM produtos p
        JOIN categorias c ON c.id = p.categoria_id
        ORDER BY c.ordem, p.id
        """
    ).fetchall()
    return [_linha_para_produto(linha) for linha in linhas]


@router.post("/produtos", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar_produto(
    dados: ProdutoCreateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> ProdutoOut:
    try:
        linha_criada = db.execute(
            """
            INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, calorias, imagem_url, tag, cor_badge, disponivel)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                dados.categoria_id,
                dados.nome,
                dados.slug,
                dados.descricao,
                dados.preco,
                dados.calorias,
                dados.imagem_url,
                dados.tag,
                dados.cor_badge,
                int(dados.disponivel),
            ),
        ).fetchone()
        db.commit()
    except psycopg.IntegrityError as erro:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(erro))

    linha = db.execute(
        "SELECT p.*, c.slug AS categoria_slug FROM produtos p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = %s",
        (linha_criada["id"],),
    ).fetchone()
    return _linha_para_produto(linha)


@router.patch("/produtos/{produto_id}", response_model=ProdutoOut)
def atualizar_produto(
    produto_id: int,
    dados: ProdutoUpdateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> ProdutoOut:
    atual = db.execute("SELECT * FROM produtos WHERE id = %s", (produto_id,)).fetchone()
    if atual is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado")

    campos = dados.model_dump(exclude_unset=True)

    # Só estas colunas podem ser alteradas por este endpoint. Sem a lista, o
    # nome da coluna no SQL vinha direto das chaves do schema Pydantic —
    # hoje isso é seguro, mas bastaria alguém adicionar um campo no schema
    # com nome diferente da coluna para gerar SQL quebrado em produção.
    # A lista deixa o contrato explícito e falha alto se algo destoar.
    desconhecidos = set(campos) - COLUNAS_PRODUTO_EDITAVEIS
    if desconhecidos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campos não editáveis: {', '.join(sorted(desconhecidos))}",
        )

    if campos:
        if "disponivel" in campos:
            campos["disponivel"] = int(campos["disponivel"])
        atribuicoes = ", ".join(f"{campo} = %s" for campo in campos)
        valores = list(campos.values())
        try:
            db.execute(f"UPDATE produtos SET {atribuicoes} WHERE id = %s", (*valores, produto_id))
            db.commit()
        except psycopg.IntegrityError as erro:
            # Ex.: tentar usar um slug que já existe em outro produto.
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(erro))

    linha = db.execute(
        "SELECT p.*, c.slug AS categoria_slug FROM produtos p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = %s",
        (produto_id,),
    ).fetchone()
    return _linha_para_produto(linha)

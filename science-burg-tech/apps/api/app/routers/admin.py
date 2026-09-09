import secrets
from datetime import datetime, timezone
from typing import Optional

import psycopg
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.auth_admin import criar_token_admin, exigir_papel_admin, get_admin_atual
from app.auth_cliente import gastar_tempo_de_verificacao, verificar_senha
from app.db import get_db
from app.limite_tentativas import registrar_falha, registrar_sucesso, segundos_de_bloqueio
from app.routers.mesas import _montar_comanda_out
from app.routers.pedidos import _linha_para_pedido
from app.schemas import (
    AdminLoginIn,
    AdministradorOut,
    AdminTokenOut,
    AvaliacaoAdminOut,
    AvaliacaoModeracaoIn,
    ComboCreateIn,
    ComboOut,
    ComboUpdateIn,
    CupomCreateIn,
    CupomOut,
    CupomUpdateIn,
    FecharComandaIn,
    ImagemUploadOut,
    MesaAdminOut,
    MesaOut,
    PedidoAdminOut,
    PedidoStatusIn,
    ProdutoCreateIn,
    ProdutoOut,
    ProdutoUpdateIn,
    PromocaoAdminOut,
    PromocaoCreateIn,
    PromocaoUpdateIn,
)
from app.routers.avaliacoes import _linha_para_avaliacao_admin
from app.routers.cardapio import _linha_para_produto
from app.routers.combos import _linha_para_combo, gravar_itens_combo
from app.routers.cupons import _linha_para_cupom
from app.routers.promocoes import _linha_para_promocao_admin
from app.websocket import gerenciador_admin

TIPOS_IMAGEM_PERMITIDOS = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
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
    db: psycopg.Connection = Depends(get_db),
) -> ImagemUploadOut:
    if (file.content_type or "") not in TIPOS_IMAGEM_PERMITIDOS:
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

    # Os bytes vão para o banco, não para o disco: no Render o sistema de
    # arquivos da instância é efêmero, então a cada deploy ou hibernação as
    # fotos gravadas em disco sumiam e o cardápio ficava com imagem quebrada,
    # porque o banco guardava só o caminho do arquivo.
    imagem_id = secrets.token_urlsafe(12)
    db.execute(
        "INSERT INTO imagens (id, mime, conteudo) VALUES (%s, %s, %s)",
        (imagem_id, file.content_type, conteudo),
    )
    db.commit()

    return ImagemUploadOut(url=f"/api/imagens/{imagem_id}")


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


# ── Cupons ───────────────────────────────────────────────────────────────────


@router.get("/cupons", response_model=list[CupomOut])
def listar_cupons_admin(_admin: dict = Depends(get_admin_atual), db: psycopg.Connection = Depends(get_db)) -> list[CupomOut]:
    linhas = db.execute("SELECT * FROM cupons ORDER BY criado_em DESC").fetchall()
    return [_linha_para_cupom(linha) for linha in linhas]


@router.post("/cupons", response_model=CupomOut, status_code=status.HTTP_201_CREATED)
def criar_cupom(
    dados: CupomCreateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> CupomOut:
    try:
        linha = db.execute(
            """
            INSERT INTO cupons
              (codigo, tipo_desconto, valor, valor_minimo_pedido, limite_uso_total, limite_uso_por_usuario, valido_de, valido_ate, ativo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                dados.codigo.strip().upper(),
                dados.tipo_desconto,
                dados.valor,
                dados.valor_minimo_pedido,
                dados.limite_uso_total,
                dados.limite_uso_por_usuario,
                dados.valido_de,
                dados.valido_ate,
                int(dados.ativo),
            ),
        ).fetchone()
        db.commit()
    except psycopg.IntegrityError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Já existe um cupom com esse código")

    linha_completa = db.execute("SELECT * FROM cupons WHERE id = %s", (linha["id"],)).fetchone()
    return _linha_para_cupom(linha_completa)


COLUNAS_CUPOM_EDITAVEIS = {
    "tipo_desconto",
    "valor",
    "valor_minimo_pedido",
    "limite_uso_total",
    "limite_uso_por_usuario",
    "valido_de",
    "valido_ate",
    "ativo",
}


@router.patch("/cupons/{cupom_id}", response_model=CupomOut)
def atualizar_cupom(
    cupom_id: int,
    dados: CupomUpdateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> CupomOut:
    atual = db.execute("SELECT * FROM cupons WHERE id = %s", (cupom_id,)).fetchone()
    if atual is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cupom não encontrado")

    campos = dados.model_dump(exclude_unset=True)
    desconhecidos = set(campos) - COLUNAS_CUPOM_EDITAVEIS
    if desconhecidos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campos não editáveis: {', '.join(sorted(desconhecidos))}",
        )

    tipo_final = campos.get("tipo_desconto", atual["tipo_desconto"])
    valor_final = campos.get("valor", atual["valor"])
    if tipo_final == "percentual" and valor_final > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Um cupom percentual não pode passar de 100%")

    if campos:
        if "ativo" in campos:
            campos["ativo"] = int(campos["ativo"])
        atribuicoes = ", ".join(f"{campo} = %s" for campo in campos)
        db.execute(f"UPDATE cupons SET {atribuicoes} WHERE id = %s", (*campos.values(), cupom_id))
        db.commit()

    linha = db.execute("SELECT * FROM cupons WHERE id = %s", (cupom_id,)).fetchone()
    return _linha_para_cupom(linha)


# ── Promoções ────────────────────────────────────────────────────────────────


@router.get("/promocoes", response_model=list[PromocaoAdminOut])
def listar_promocoes_admin(
    _admin: dict = Depends(get_admin_atual), db: psycopg.Connection = Depends(get_db)
) -> list[PromocaoAdminOut]:
    linhas = db.execute("SELECT * FROM promocoes ORDER BY ordem, id").fetchall()
    return [_linha_para_promocao_admin(linha) for linha in linhas]


@router.post("/promocoes", response_model=PromocaoAdminOut, status_code=status.HTTP_201_CREATED)
def criar_promocao(
    dados: PromocaoCreateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> PromocaoAdminOut:
    linha = db.execute(
        """
        INSERT INTO promocoes (titulo, subtitulo, imagem_url, cupom_id, ordem, ativo, valido_de, valido_ate)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            dados.titulo,
            dados.subtitulo,
            dados.imagem_url,
            dados.cupom_id,
            dados.ordem,
            int(dados.ativo),
            dados.valido_de,
            dados.valido_ate,
        ),
    ).fetchone()
    db.commit()

    linha_completa = db.execute("SELECT * FROM promocoes WHERE id = %s", (linha["id"],)).fetchone()
    return _linha_para_promocao_admin(linha_completa)


COLUNAS_PROMOCAO_EDITAVEIS = {"titulo", "subtitulo", "imagem_url", "cupom_id", "ordem", "ativo", "valido_de", "valido_ate"}


@router.patch("/promocoes/{promocao_id}", response_model=PromocaoAdminOut)
def atualizar_promocao(
    promocao_id: int,
    dados: PromocaoUpdateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> PromocaoAdminOut:
    atual = db.execute("SELECT * FROM promocoes WHERE id = %s", (promocao_id,)).fetchone()
    if atual is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promoção não encontrada")

    campos = dados.model_dump(exclude_unset=True)
    desconhecidos = set(campos) - COLUNAS_PROMOCAO_EDITAVEIS
    if desconhecidos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campos não editáveis: {', '.join(sorted(desconhecidos))}",
        )

    if campos:
        if "ativo" in campos:
            campos["ativo"] = int(campos["ativo"])
        atribuicoes = ", ".join(f"{campo} = %s" for campo in campos)
        db.execute(f"UPDATE promocoes SET {atribuicoes} WHERE id = %s", (*campos.values(), promocao_id))
        db.commit()

    linha = db.execute("SELECT * FROM promocoes WHERE id = %s", (promocao_id,)).fetchone()
    return _linha_para_promocao_admin(linha)


# ── Combos ───────────────────────────────────────────────────────────────────


@router.get("/combos", response_model=list[ComboOut])
def listar_combos_admin(_admin: dict = Depends(get_admin_atual), db: psycopg.Connection = Depends(get_db)) -> list[ComboOut]:
    linhas = db.execute("SELECT * FROM combos ORDER BY id").fetchall()
    return [_linha_para_combo(db, linha) for linha in linhas]


@router.post("/combos", response_model=ComboOut, status_code=status.HTTP_201_CREATED)
def criar_combo(
    dados: ComboCreateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> ComboOut:
    try:
        linha = db.execute(
            """
            INSERT INTO combos (nome, slug, descricao, preco, imagem_url, disponivel)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (dados.nome, dados.slug, dados.descricao, dados.preco, dados.imagem_url, int(dados.disponivel)),
        ).fetchone()
        gravar_itens_combo(db, linha["id"], dados.itens)
        db.commit()
    except psycopg.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Já existe um combo com esse identificador (slug)")

    linha_completa = db.execute("SELECT * FROM combos WHERE id = %s", (linha["id"],)).fetchone()
    return _linha_para_combo(db, linha_completa)


COLUNAS_COMBO_EDITAVEIS = {"nome", "descricao", "preco", "imagem_url", "disponivel"}


@router.patch("/combos/{combo_id}", response_model=ComboOut)
def atualizar_combo(
    combo_id: int,
    dados: ComboUpdateIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> ComboOut:
    atual = db.execute("SELECT * FROM combos WHERE id = %s", (combo_id,)).fetchone()
    if atual is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Combo não encontrado")

    campos = dados.model_dump(exclude_unset=True, exclude={"itens"})
    desconhecidos = set(campos) - COLUNAS_COMBO_EDITAVEIS
    if desconhecidos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campos não editáveis: {', '.join(sorted(desconhecidos))}",
        )

    if campos:
        if "disponivel" in campos:
            campos["disponivel"] = int(campos["disponivel"])
        atribuicoes = ", ".join(f"{campo} = %s" for campo in campos)
        db.execute(f"UPDATE combos SET {atribuicoes} WHERE id = %s", (*campos.values(), combo_id))

    if dados.itens is not None:
        gravar_itens_combo(db, combo_id, dados.itens)

    db.commit()
    linha = db.execute("SELECT * FROM combos WHERE id = %s", (combo_id,)).fetchone()
    return _linha_para_combo(db, linha)


# ── Avaliações (moderação) ────────────────────────────────────────────────────


@router.get("/avaliacoes", response_model=list[AvaliacaoAdminOut])
def listar_avaliacoes_admin(
    _admin: dict = Depends(get_admin_atual), db: psycopg.Connection = Depends(get_db)
) -> list[AvaliacaoAdminOut]:
    linhas = db.execute(
        """
        SELECT a.*, u.nome AS usuario_nome
        FROM avaliacoes a
        JOIN usuarios u ON u.id = a.usuario_id
        ORDER BY a.criado_em DESC
        """
    ).fetchall()
    return [_linha_para_avaliacao_admin(linha) for linha in linhas]


@router.patch("/avaliacoes/{avaliacao_id}", response_model=AvaliacaoAdminOut)
def moderar_avaliacao(
    avaliacao_id: int,
    dados: AvaliacaoModeracaoIn,
    _admin: dict = Depends(exigir_papel_admin),
    db: psycopg.Connection = Depends(get_db),
) -> AvaliacaoAdminOut:
    atual = db.execute("SELECT * FROM avaliacoes WHERE id = %s", (avaliacao_id,)).fetchone()
    if atual is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avaliação não encontrada")

    db.execute("UPDATE avaliacoes SET aprovado = %s WHERE id = %s", (int(dados.aprovado), avaliacao_id))
    db.commit()

    linha = db.execute(
        "SELECT a.*, u.nome AS usuario_nome FROM avaliacoes a JOIN usuarios u ON u.id = a.usuario_id WHERE a.id = %s",
        (avaliacao_id,),
    ).fetchone()
    return _linha_para_avaliacao_admin(linha)

from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

# ── Cardápio ────────────────────────────────────────────────────────────────


class CategoriaOut(BaseModel):
    id: int
    slug: str
    nome: str
    emoji: Optional[str]
    ordem: int


class ProdutoOut(BaseModel):
    id: int
    categoria_id: int
    categoria_slug: str
    nome: str
    slug: str
    descricao: Optional[str]
    preco: float
    calorias: Optional[int]
    imagem_url: Optional[str]
    tag: Optional[str]
    cor_badge: Optional[str]
    disponivel: bool


class ProdutoCreateIn(BaseModel):
    categoria_id: int
    nome: str
    slug: str
    descricao: Optional[str] = None
    preco: float = Field(ge=0)
    calorias: Optional[int] = Field(default=None, ge=0)
    imagem_url: Optional[str] = None
    tag: Optional[str] = None
    cor_badge: Optional[str] = None
    disponivel: bool = True


class ImagemUploadOut(BaseModel):
    url: str


class ProdutoUpdateIn(BaseModel):
    categoria_id: Optional[int] = None
    nome: Optional[str] = None
    descricao: Optional[str] = None
    preco: Optional[float] = Field(default=None, ge=0)
    calorias: Optional[int] = Field(default=None, ge=0)
    imagem_url: Optional[str] = None
    tag: Optional[str] = None
    cor_badge: Optional[str] = None
    disponivel: Optional[bool] = None


# ── Autenticação de cliente ─────────────────────────────────────────────────


class RegistoIn(BaseModel):
    nome: str = Field(min_length=1)
    email: EmailStr
    senha: str = Field(min_length=6)
    telefone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    senha: str


class UsuarioOut(BaseModel):
    id: int
    nome: str
    email: str
    telefone: Optional[str]


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    usuario: UsuarioOut


# ── Autenticação de administrador ───────────────────────────────────────────


class AdminLoginIn(BaseModel):
    email: EmailStr
    senha: str


class AdministradorOut(BaseModel):
    id: int
    nome: str
    email: str
    papel: Literal["admin", "atendente"]


class AdminTokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    administrador: AdministradorOut


# ── Pedidos ──────────────────────────────────────────────────────────────────


class ItemPedidoIn(BaseModel):
    # Uma linha do pedido é OU um produto avulso OU um combo — nunca os
    # dois, nunca nenhum.
    produto_id: Optional[int] = None
    combo_id: Optional[int] = None
    quantidade: int = Field(gt=0)

    @model_validator(mode="after")
    def _exatamente_um_produto_ou_combo(self) -> "ItemPedidoIn":
        if (self.produto_id is None) == (self.combo_id is None):
            raise ValueError("Informe exatamente um entre produto_id e combo_id")
        return self


class EnderecoIn(BaseModel):
    rua: str
    numero: str
    complemento: Optional[str] = None
    bairro: str
    cidade: str
    estado: str
    cep: str


class EnderecoOut(BaseModel):
    id: int
    rua: str
    numero: str
    complemento: Optional[str]
    bairro: str
    cidade: str
    estado: str
    cep: str
    padrao: bool


class ItemPedidoOut(BaseModel):
    id: int
    produto_id: Optional[int]
    combo_id: Optional[int] = None
    nome_produto: str
    preco_unitario: float
    quantidade: int
    subtotal: float


class PedidoCreateIn(BaseModel):
    tipo: Literal["entrega", "retirada"]
    itens: list[ItemPedidoIn] = Field(min_length=1)
    endereco: Optional[EnderecoIn] = None
    endereco_id: Optional[int] = None
    metodo_pagamento: Optional[str] = None
    observacoes: Optional[str] = None
    codigo_cupom: Optional[str] = None


class PedidoOut(BaseModel):
    id: int
    tipo: str
    status: str
    metodo_pagamento: Optional[str]
    subtotal: float
    taxa_entrega: float
    desconto: float = 0.0
    cupom_codigo: Optional[str] = None
    total: float
    observacoes: Optional[str]
    criado_em: str
    itens: list[ItemPedidoOut]
    avaliacao_id: Optional[int] = None


class PedidoAdminOut(PedidoOut):
    usuario_nome: Optional[str] = None
    mesa_numero: Optional[int] = None


class PedidoStatusIn(BaseModel):
    status: Literal[
        "pendente",
        "confirmado",
        "em_preparo",
        "saiu_para_entrega",
        "pronto",
        "entregue",
        "cancelado",
    ]


# ── Mesas ────────────────────────────────────────────────────────────────────


class MesaOut(BaseModel):
    id: int
    numero: int
    capacidade: int
    status: str


class ComandaOut(BaseModel):
    id: int
    status: str
    numero_pessoas: Optional[int]
    aberta_em: str
    itens: list[ItemPedidoOut]
    total: float


class MesaComandaOut(BaseModel):
    mesa: MesaOut
    comanda: Optional[ComandaOut]


class PedidoMesaIn(BaseModel):
    itens: list[ItemPedidoIn] = Field(min_length=1)
    observacoes: Optional[str] = None


class MesaAdminOut(BaseModel):
    mesa: MesaOut
    comanda: Optional[ComandaOut]


class FecharComandaIn(BaseModel):
    metodo: Literal["cartao_credito", "cartao_debito", "pix", "dinheiro"]


# ── Mesas Virtuais ("Network da Fome") ────────────────────────────────────

TemaMesaVirtual = Literal[
    "games", "tecnologia", "programacao", "ciencia",
    "filmes_series", "musica", "livros", "papo_livre",
]


class ParticipanteMesaVirtualOut(BaseModel):
    usuario_id: int
    nome: str
    lugar_numero: int
    comendo: Optional[str] = None
    entrou_em: str


class MesaVirtualOut(BaseModel):
    id: int
    nome: str
    capacidade: int
    tema: Optional[TemaMesaVirtual]
    lugares_ocupados: int
    lugares_disponiveis: int
    cheia: bool
    participantes: list[ParticipanteMesaVirtualOut]


class LugarMesaVirtualOut(BaseModel):
    numero: int
    participante: Optional[ParticipanteMesaVirtualOut]


class MesaVirtualDetalheOut(BaseModel):
    id: int
    nome: str
    capacidade: int
    tema: Optional[TemaMesaVirtual]
    lugares: list[LugarMesaVirtualOut]
    meu_lugar: Optional[int] = None


class SentarMesaVirtualIn(BaseModel):
    lugar_numero: Optional[int] = Field(default=None, gt=0)


class MensagemMesaVirtualOut(BaseModel):
    id: int
    mesa_virtual_id: int
    usuario_id: int
    nome: str
    texto: str
    criado_em: str


class EnviarMensagemMesaVirtualIn(BaseModel):
    texto: str = Field(min_length=1, max_length=500)


class DenunciaMesaVirtualIn(BaseModel):
    denunciado_usuario_id: int
    motivo: str = Field(min_length=1, max_length=500)
    mensagem_id: Optional[int] = None


class BloqueioIn(BaseModel):
    bloqueado_usuario_id: int


class UsuarioBloqueadoOut(BaseModel):
    usuario_id: int
    nome: str


# ── Moderação (painel do dono) ───────────────────────────────────────────────


class ParticipanteAdminOut(ParticipanteMesaVirtualOut):
    email: str


class MesaVirtualAdminOut(BaseModel):
    id: int
    nome: str
    capacidade: int
    tema: Optional[TemaMesaVirtual]
    ativa: bool
    participantes: list[ParticipanteAdminOut]


class DenunciaAdminOut(BaseModel):
    id: int
    mesa_virtual_id: int
    mesa_virtual_nome: str
    denunciante_id: int
    denunciante_nome: str
    denunciado_id: int
    denunciado_nome: str
    motivo: str
    mensagem_texto: Optional[str]
    status: str
    criado_em: str


class DenunciaStatusIn(BaseModel):
    status: Literal["pendente", "analisada"]


class BanirUsuarioIn(BaseModel):
    motivo: Optional[str] = None


# ── Relatórios (painel do dono) ───────────────────────────────────────────────


class FaturamentoPorDiaOut(BaseModel):
    data: str
    total: float


class FaturamentoPorTipoOut(BaseModel):
    tipo: str
    total: float


class ProdutoMaisVendidoOut(BaseModel):
    nome_produto: str
    quantidade: int
    total: float


class PagamentoPorMetodoOut(BaseModel):
    metodo: str
    total: float


class PedidosPorHoraOut(BaseModel):
    hora: int
    quantidade: int


class RelatorioOut(BaseModel):
    periodo_dias: int
    faturamento_total: float
    total_pedidos: int
    ticket_medio: float
    faturamento_por_dia: list[FaturamentoPorDiaOut]
    faturamento_por_tipo: list[FaturamentoPorTipoOut]
    produtos_mais_vendidos: list[ProdutoMaisVendidoOut]
    pagamentos_por_metodo: list[PagamentoPorMetodoOut]
    pedidos_por_hora: list[PedidosPorHoraOut]


# ── Cupons ────────────────────────────────────────────────────────────────────


class CupomOut(BaseModel):
    id: int
    codigo: str
    tipo_desconto: Literal["percentual", "fixo"]
    valor: float
    valor_minimo_pedido: float
    limite_uso_total: Optional[int]
    limite_uso_por_usuario: Optional[int]
    valido_de: Optional[str]
    valido_ate: Optional[str]
    ativo: bool


class CupomCreateIn(BaseModel):
    codigo: str = Field(min_length=2)
    tipo_desconto: Literal["percentual", "fixo"]
    valor: float = Field(gt=0)
    valor_minimo_pedido: float = Field(default=0, ge=0)
    limite_uso_total: Optional[int] = Field(default=None, gt=0)
    limite_uso_por_usuario: Optional[int] = Field(default=None, gt=0)
    valido_de: Optional[str] = None
    valido_ate: Optional[str] = None
    ativo: bool = True

    @model_validator(mode="after")
    def _percentual_no_maximo_100(self) -> "CupomCreateIn":
        if self.tipo_desconto == "percentual" and self.valor > 100:
            raise ValueError("Um cupom percentual não pode passar de 100%")
        return self


class CupomUpdateIn(BaseModel):
    tipo_desconto: Optional[Literal["percentual", "fixo"]] = None
    valor: Optional[float] = Field(default=None, gt=0)
    valor_minimo_pedido: Optional[float] = Field(default=None, ge=0)
    limite_uso_total: Optional[int] = Field(default=None, gt=0)
    limite_uso_por_usuario: Optional[int] = Field(default=None, gt=0)
    valido_de: Optional[str] = None
    valido_ate: Optional[str] = None
    ativo: Optional[bool] = None


class CupomValidarIn(BaseModel):
    codigo: str
    subtotal: float = Field(ge=0)


class CupomValidarOut(BaseModel):
    valido: bool
    motivo: Optional[str] = None
    codigo: Optional[str] = None
    desconto: float = 0.0


# ── Promoções ────────────────────────────────────────────────────────────────


class PromocaoOut(BaseModel):
    id: int
    titulo: str
    subtitulo: Optional[str]
    imagem_url: str
    cupom_codigo: Optional[str] = None
    ordem: int
    ativo: bool
    valido_de: Optional[str]
    valido_ate: Optional[str]


class PromocaoAdminOut(BaseModel):
    id: int
    titulo: str
    subtitulo: Optional[str]
    imagem_url: str
    cupom_id: Optional[int]
    ordem: int
    ativo: bool
    valido_de: Optional[str]
    valido_ate: Optional[str]


class PromocaoCreateIn(BaseModel):
    titulo: str = Field(min_length=1)
    subtitulo: Optional[str] = None
    imagem_url: str
    cupom_id: Optional[int] = None
    ordem: int = 0
    ativo: bool = True
    valido_de: Optional[str] = None
    valido_ate: Optional[str] = None


class PromocaoUpdateIn(BaseModel):
    titulo: Optional[str] = None
    subtitulo: Optional[str] = None
    imagem_url: Optional[str] = None
    cupom_id: Optional[int] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None
    valido_de: Optional[str] = None
    valido_ate: Optional[str] = None


# ── Combos ───────────────────────────────────────────────────────────────────


class ComboItemOut(BaseModel):
    produto_id: int
    nome: str
    quantidade: int


class ComboOut(BaseModel):
    id: int
    nome: str
    slug: str
    descricao: Optional[str]
    preco: float
    imagem_url: Optional[str]
    disponivel: bool
    itens: list[ComboItemOut]


class ComboItemIn(BaseModel):
    produto_id: int
    quantidade: int = Field(default=1, gt=0)


class ComboCreateIn(BaseModel):
    nome: str = Field(min_length=1)
    slug: str = Field(min_length=1)
    descricao: Optional[str] = None
    preco: float = Field(ge=0)
    imagem_url: Optional[str] = None
    disponivel: bool = True
    itens: list[ComboItemIn] = Field(min_length=1)


class ComboUpdateIn(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    preco: Optional[float] = Field(default=None, ge=0)
    imagem_url: Optional[str] = None
    disponivel: Optional[bool] = None
    itens: Optional[list[ComboItemIn]] = None


# ── Avaliações ───────────────────────────────────────────────────────────────


class AvaliacaoOut(BaseModel):
    id: int
    usuario_nome: str
    nota: int
    comentario: Optional[str]
    criado_em: str


class AvaliacaoCreateIn(BaseModel):
    pedido_id: int
    nota: int = Field(ge=1, le=5)
    comentario: Optional[str] = None


class AvaliacaoAdminOut(BaseModel):
    id: int
    usuario_nome: str
    pedido_id: int
    nota: int
    comentario: Optional[str]
    aprovado: bool
    criado_em: str


class AvaliacaoModeracaoIn(BaseModel):
    aprovado: bool


# ── G.P.T. (Grill Potato Toast) ─────────────────────────────────────────────


class GptMensagemIn(BaseModel):
    # "cliente" = quem digitou; "gpt" = resposta anterior do atendente.
    autor: Literal["cliente", "gpt"]
    # Teto de tamanho: uma pergunta de cardápio não precisa de mais que isso,
    # e o limite evita que alguém use nosso endpoint para processar textões.
    texto: str = Field(min_length=1, max_length=600)


class GptConversaIn(BaseModel):
    # Só as últimas trocas são enviadas: histórico longo encarece a chamada
    # sem melhorar a resposta num atendimento curto como este.
    mensagens: list[GptMensagemIn] = Field(min_length=1, max_length=12)


class GptRespostaOut(BaseModel):
    resposta: str
    disponivel: bool

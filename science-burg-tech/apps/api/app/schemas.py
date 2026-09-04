from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

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
    produto_id: int
    quantidade: int = Field(gt=0)


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


class PedidoOut(BaseModel):
    id: int
    tipo: str
    status: str
    metodo_pagamento: Optional[str]
    subtotal: float
    taxa_entrega: float
    total: float
    observacoes: Optional[str]
    criado_em: str
    itens: list[ItemPedidoOut]


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

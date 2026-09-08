export type Item = {
  id: number;
  slug: string;
  nome: string;
  preco: number;
  img: string;
  kcal: number | null;
  tag: string | null;
  descricao: string;
  badge?: string;
};

export type Pedido = { id: number; tipo: "produto" | "combo"; nome: string; preco: number; qty: number };

export type Cat = "hamburguer" | "acompanhamento" | "bebida" | "sobremesa";

export type ComboItemResumo = { produtoId: number; nome: string; quantidade: number };

export type Combo = {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  preco: number;
  img: string;
  disponivel: boolean;
  itens: ComboItemResumo[];
};

export type CartContext = {
  cart: Pedido[];
  addCart: (item: Item) => void;
  addComboCart: (combo: Combo) => void;
  changeQty: (id: number, tipo: "produto" | "combo", d: number) => void;
  clearCart: () => void;
  adicionarVarios: (itens: Pedido[]) => void;
  totalQty: number;
  totalPrc: number;
};

// ── Tipos que espelham as respostas da API (apps/api) ───────────────────────

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
};

export type Administrador = {
  id: number;
  nome: string;
  email: string;
  papel: "admin" | "atendente";
};

export type ItemPedidoApi = {
  id: number;
  produto_id: number | null;
  combo_id: number | null;
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
};

export type StatusPedido =
  | "pendente"
  | "confirmado"
  | "em_preparo"
  | "saiu_para_entrega"
  | "pronto"
  | "entregue"
  | "cancelado";

export type PedidoApi = {
  id: number;
  tipo: "entrega" | "retirada" | "local";
  status: StatusPedido;
  metodo_pagamento: string | null;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  cupom_codigo: string | null;
  total: number;
  observacoes: string | null;
  criado_em: string;
  itens: ItemPedidoApi[];
  avaliacao_id: number | null;
};

export type PedidoAdminApi = PedidoApi & {
  usuario_nome: string | null;
  mesa_numero: number | null;
};

export type MesaStatus = "livre" | "ocupada" | "reservada" | "inativa";

export type MesaApi = {
  id: number;
  numero: number;
  capacidade: number;
  status: MesaStatus;
};

export type ComandaApi = {
  id: number;
  status: string;
  numero_pessoas: number | null;
  aberta_em: string;
  itens: ItemPedidoApi[];
  total: number;
};

export type MesaComandaApi = {
  mesa: MesaApi;
  comanda: ComandaApi | null;
};

export type EnderecoIn = {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

// ── Mesas Virtuais ("Network da Fome") ───────────────────────────────────

export type TemaMesaVirtual =
  | "games"
  | "tecnologia"
  | "programacao"
  | "ciencia"
  | "filmes_series"
  | "musica"
  | "livros"
  | "papo_livre";

export type ParticipanteMesaVirtualApi = {
  usuario_id: number;
  nome: string;
  lugar_numero: number;
  comendo: string | null;
  entrou_em: string;
};

export type MesaVirtualApi = {
  id: number;
  nome: string;
  capacidade: number;
  tema: TemaMesaVirtual | null;
  lugares_ocupados: number;
  lugares_disponiveis: number;
  cheia: boolean;
  participantes: ParticipanteMesaVirtualApi[];
};

export type LugarMesaVirtualApi = {
  numero: number;
  participante: ParticipanteMesaVirtualApi | null;
};

export type MesaVirtualDetalheApi = {
  id: number;
  nome: string;
  capacidade: number;
  tema: TemaMesaVirtual | null;
  lugares: LugarMesaVirtualApi[];
  meu_lugar: number | null;
};

export type MensagemMesaVirtualApi = {
  id: number;
  mesa_virtual_id: number;
  usuario_id: number;
  nome: string;
  texto: string;
  criado_em: string;
};

export type ParticipanteAdminApi = ParticipanteMesaVirtualApi & { email: string };

export type MesaVirtualAdminApi = {
  id: number;
  nome: string;
  capacidade: number;
  tema: TemaMesaVirtual | null;
  ativa: boolean;
  participantes: ParticipanteAdminApi[];
};

export type DenunciaAdminApi = {
  id: number;
  mesa_virtual_id: number;
  mesa_virtual_nome: string;
  denunciante_id: number;
  denunciante_nome: string;
  denunciado_id: number;
  denunciado_nome: string;
  motivo: string;
  mensagem_texto: string | null;
  status: "pendente" | "analisada";
  criado_em: string;
};

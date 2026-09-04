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

export type Pedido = { id: number; nome: string; preco: number; qty: number };

export type Cat = "hamburguer" | "acompanhamento" | "bebida" | "sobremesa";

export type CartContext = {
  cart: Pedido[];
  addCart: (item: Item) => void;
  changeQty: (id: number, d: number) => void;
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
  total: number;
  observacoes: string | null;
  criado_em: string;
  itens: ItemPedidoApi[];
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

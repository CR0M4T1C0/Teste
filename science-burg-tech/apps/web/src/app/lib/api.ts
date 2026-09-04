import type {
  Administrador,
  EnderecoIn,
  MesaComandaApi,
  PedidoAdminApi,
  PedidoApi,
  StatusPedido,
  Usuario,
} from "@/app/types";

/**
 * Endereço base da API.
 *
 * Em desenvolvimento fica vazio: as chamadas saem como "/api/..." e o proxy
 * do Vite (vite.config.ts) encaminha para o Python em 127.0.0.1:8000.
 *
 * Em produção o front (Netlify) e a API (outro serviço) ficam em domínios
 * diferentes, então é preciso informar o endereço completo da API na
 * variável VITE_API_URL — sem barra no final. Exemplo:
 *     VITE_API_URL=https://science-burg-api.onrender.com
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Para upload de arquivo (FormData), não define Content-Type: o navegador
  // precisa gerar o boundary do multipart sozinho.
  const ehFormData = options.body instanceof FormData;

  const resposta = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      ...(ehFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!resposta.ok) {
    let detalhe = resposta.statusText;
    try {
      const corpo = await resposta.json();
      detalhe = corpo?.detail || detalhe;
    } catch {
      // corpo sem JSON (ex.: 500 genérico) — mantém o statusText
    }
    throw new ApiError(resposta.status, detalhe);
  }

  if (resposta.status === 204) return undefined as T;
  return resposta.json();
}

function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ── Cardápio ────────────────────────────────────────────────────────────────

export type CategoriaApi = { id: number; slug: string; nome: string; emoji: string | null; ordem: number };
export type ProdutoApi = {
  id: number;
  categoria_id: number;
  categoria_slug: string;
  nome: string;
  slug: string;
  descricao: string | null;
  preco: number;
  calorias: number | null;
  imagem_url: string | null;
  tag: string | null;
  cor_badge: string | null;
  disponivel: boolean;
};

export const getCategorias = () => apiFetch<CategoriaApi[]>("/categorias");
export const getProdutos = () => apiFetch<ProdutoApi[]>("/produtos");

// ── Autenticação de cliente ─────────────────────────────────────────────────

export type TokenClienteResposta = { access_token: string; token_type: string; usuario: Usuario };

export const registarCliente = (dados: { nome: string; email: string; senha: string; telefone?: string }) =>
  apiFetch<TokenClienteResposta>("/auth/registo", { method: "POST", body: JSON.stringify(dados) });

export const loginCliente = (dados: { email: string; senha: string }) =>
  apiFetch<TokenClienteResposta>("/auth/login", { method: "POST", body: JSON.stringify(dados) });

// ── Pedidos (entrega/retirada) ──────────────────────────────────────────────

export type PedidoCreateIn = {
  tipo: "entrega" | "retirada";
  itens: { produto_id: number; quantidade: number }[];
  endereco?: EnderecoIn;
  endereco_id?: number;
  metodo_pagamento?: string;
  observacoes?: string;
};

export const criarPedido = (token: string, dados: PedidoCreateIn) =>
  apiFetch<PedidoApi>("/pedidos", { method: "POST", body: JSON.stringify(dados), headers: authHeader(token) });

export const meusPedidos = (token: string) => apiFetch<PedidoApi[]>("/pedidos/me", { headers: authHeader(token) });

// ── Endereços salvos ─────────────────────────────────────────────────────────

export type EnderecoApi = EnderecoIn & { id: number; padrao: boolean };

export const getMeusEnderecos = (token: string) => apiFetch<EnderecoApi[]>("/enderecos", { headers: authHeader(token) });

export async function buscarEnderecoPorCep(cep: string): Promise<Pick<EnderecoIn, "rua" | "bairro" | "cidade" | "estado"> | null> {
  const cepLimpo = cep.replace(/\D/g, "");
  if (cepLimpo.length !== 8) return null;
  const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
  if (!resposta.ok) return null;
  const dados = await resposta.json();
  if (dados.erro) return null;
  return { rua: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade, estado: dados.uf };
}

// ── Mesas ────────────────────────────────────────────────────────────────────

export const getMesa = (qrToken: string) => apiFetch<MesaComandaApi>(`/mesas/${qrToken}`);

export const criarPedidoMesa = (qrToken: string, dados: { itens: { produto_id: number; quantidade: number }[]; observacoes?: string }) =>
  apiFetch<MesaComandaApi>(`/mesas/${qrToken}/pedidos`, { method: "POST", body: JSON.stringify(dados) });

export const pedirConta = (qrToken: string) => apiFetch<{ mensagem: string }>(`/mesas/${qrToken}/fechar`, { method: "POST" });

// ── Administração ────────────────────────────────────────────────────────────

export type TokenAdminResposta = { access_token: string; token_type: string; administrador: Administrador };

export const loginAdmin = (dados: { email: string; senha: string }) =>
  apiFetch<TokenAdminResposta>("/admin/auth/login", { method: "POST", body: JSON.stringify(dados) });

export const adminListarPedidos = (token: string, filtros?: { tipo?: string; status_filtro?: string }) => {
  const params = new URLSearchParams();
  if (filtros?.tipo) params.set("tipo", filtros.tipo);
  if (filtros?.status_filtro) params.set("status_filtro", filtros.status_filtro);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<PedidoAdminApi[]>(`/admin/pedidos${query}`, { headers: authHeader(token) });
};

export const adminAlterarStatusPedido = (token: string, pedidoId: number, status: StatusPedido) =>
  apiFetch<PedidoAdminApi>(`/admin/pedidos/${pedidoId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    headers: authHeader(token),
  });

export const adminListarCozinha = (token: string) => apiFetch<PedidoAdminApi[]>("/admin/cozinha", { headers: authHeader(token) });

export type MesaAdminApi = MesaComandaApi;

export const adminListarMesas = (token: string) => apiFetch<MesaAdminApi[]>("/admin/mesas", { headers: authHeader(token) });

export const adminFecharComanda = (token: string, comandaId: number, metodo: string) =>
  apiFetch<{ mensagem: string; total: number }>(`/admin/comandas/${comandaId}/fechar`, {
    method: "PATCH",
    body: JSON.stringify({ metodo }),
    headers: authHeader(token),
  });

export const adminListarProdutos = (token: string) => apiFetch<ProdutoApi[]>("/admin/produtos", { headers: authHeader(token) });

export type ProdutoCampos = Pick<
  ProdutoApi,
  "categoria_id" | "nome" | "slug" | "descricao" | "preco" | "calorias" | "imagem_url" | "tag" | "cor_badge" | "disponivel"
>;

export const adminCriarProduto = (token: string, dados: ProdutoCampos) =>
  apiFetch<ProdutoApi>("/admin/produtos", { method: "POST", body: JSON.stringify(dados), headers: authHeader(token) });

export const adminAtualizarProduto = (token: string, produtoId: number, dados: Partial<ProdutoCampos>) =>
  apiFetch<ProdutoApi>(`/admin/produtos/${produtoId}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
    headers: authHeader(token),
  });

export const adminUploadImagem = async (token: string, arquivo: File) => {
  const formData = new FormData();
  formData.append("file", arquivo);
  return apiFetch<{ url: string }>("/admin/upload-imagem", { method: "POST", body: formData, headers: authHeader(token) });
};

export type RelatorioApi = {
  periodo_dias: number;
  faturamento_total: number;
  total_pedidos: number;
  ticket_medio: number;
  faturamento_por_dia: { data: string; total: number }[];
  faturamento_por_tipo: { tipo: string; total: number }[];
  produtos_mais_vendidos: { nome_produto: string; quantidade: number; total: number }[];
  pagamentos_por_metodo: { metodo: string; total: number }[];
  pedidos_por_hora: { hora: number; quantidade: number }[];
};

export const adminRelatorios = (token: string, dias: number) =>
  apiFetch<RelatorioApi>(`/admin/relatorios?dias=${dias}`, { headers: authHeader(token) });

export function wsAdminUrl(token: string): string {
  // Com VITE_API_URL definido, o WebSocket precisa ir para o host da API
  // (https -> wss). Sem ele, usa o próprio host, que em desenvolvimento é
  // redirecionado pelo proxy do Vite.
  const base = API_BASE
    ? API_BASE.replace(/^http/, "ws")
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  return `${base}/ws/admin?token=${encodeURIComponent(token)}`;
}

import type {
  Administrador,
  DenunciaAdminApi,
  EnderecoIn,
  MesaComandaApi,
  MesaVirtualAdminApi,
  MesaVirtualApi,
  MesaVirtualDetalheApi,
  MensagemMesaVirtualApi,
  PedidoAdminApi,
  PedidoApi,
  StatusPedido,
  TemaMesaVirtual,
  Usuario,
} from "@/app/types";

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

  const resposta = await fetch(`/api${path}`, {
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

export type ItemPedidoCreateIn = { produto_id: number; quantidade: number } | { combo_id: number; quantidade: number };

export type PedidoCreateIn = {
  tipo: "entrega" | "retirada";
  itens: ItemPedidoCreateIn[];
  endereco?: EnderecoIn;
  endereco_id?: number;
  metodo_pagamento?: string;
  observacoes?: string;
  codigo_cupom?: string;
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

/** Origem do WebSocket, sem barra no final (ex.: "wss://api.exemplo.com").
 *
 * As chamadas HTTP usam caminho relativo porque o Render reescreve "/api/*"
 * para a API. Com WebSocket isso não funciona: as regras de rewrite do site
 * estático valem só para HTTP, então "/ws/*" caía na regra catch-all e o
 * navegador recebia o index.html em vez de abrir a conexão. Por isso o socket
 * vai direto ao domínio da API, informado por VITE_API_URL.
 *
 * Sem essa variável — no "vite dev" — vale a origem atual, que o proxy do
 * vite.config.ts encaminha para a API local com ws: true.
 */
function wsBase(): string {
  const api: string = (import.meta.env.VITE_API_URL ?? "").trim();
  if (api) return api.replace(/\/+$/, "").replace(/^http/, "ws");

  const protocolo = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocolo}://${window.location.host}`;
}

export function wsAdminUrl(token: string): string {
  return `${wsBase()}/ws/admin?token=${encodeURIComponent(token)}`;
}

// ── Cupons ───────────────────────────────────────────────────────────────────

export type CupomApi = {
  id: number;
  codigo: string;
  tipo_desconto: "percentual" | "fixo";
  valor: number;
  valor_minimo_pedido: number;
  limite_uso_total: number | null;
  limite_uso_por_usuario: number | null;
  valido_de: string | null;
  valido_ate: string | null;
  ativo: boolean;
};

export type CupomCampos = Pick<
  CupomApi,
  "codigo" | "tipo_desconto" | "valor" | "valor_minimo_pedido" | "limite_uso_total" | "limite_uso_por_usuario" | "valido_de" | "valido_ate" | "ativo"
>;

export type CupomValidarResposta = { valido: boolean; motivo: string | null; codigo: string | null; desconto: number };

export const validarCupom = (token: string, dados: { codigo: string; subtotal: number }) =>
  apiFetch<CupomValidarResposta>("/cupons/validar", { method: "POST", body: JSON.stringify(dados), headers: authHeader(token) });

export const adminListarCupons = (token: string) => apiFetch<CupomApi[]>("/admin/cupons", { headers: authHeader(token) });

export const adminCriarCupom = (token: string, dados: Partial<CupomCampos> & Pick<CupomCampos, "codigo" | "tipo_desconto" | "valor">) =>
  apiFetch<CupomApi>("/admin/cupons", { method: "POST", body: JSON.stringify(dados), headers: authHeader(token) });

export const adminAtualizarCupom = (token: string, cupomId: number, dados: Partial<Omit<CupomCampos, "codigo">>) =>
  apiFetch<CupomApi>(`/admin/cupons/${cupomId}`, { method: "PATCH", body: JSON.stringify(dados), headers: authHeader(token) });

// ── Promoções ────────────────────────────────────────────────────────────────

export type PromocaoApi = {
  id: number;
  titulo: string;
  subtitulo: string | null;
  imagem_url: string;
  cupom_codigo: string | null;
  ordem: number;
  ativo: boolean;
  valido_de: string | null;
  valido_ate: string | null;
};

export type PromocaoAdminApi = Omit<PromocaoApi, "cupom_codigo"> & { cupom_id: number | null };

export type PromocaoCampos = Pick<PromocaoAdminApi, "titulo" | "subtitulo" | "imagem_url" | "cupom_id" | "ordem" | "ativo" | "valido_de" | "valido_ate">;

export const getPromocoes = () => apiFetch<PromocaoApi[]>("/promocoes");

export const adminListarPromocoes = (token: string) => apiFetch<PromocaoAdminApi[]>("/admin/promocoes", { headers: authHeader(token) });

export const adminCriarPromocao = (token: string, dados: Partial<PromocaoCampos> & Pick<PromocaoCampos, "titulo" | "imagem_url">) =>
  apiFetch<PromocaoAdminApi>("/admin/promocoes", { method: "POST", body: JSON.stringify(dados), headers: authHeader(token) });

export const adminAtualizarPromocao = (token: string, promocaoId: number, dados: Partial<PromocaoCampos>) =>
  apiFetch<PromocaoAdminApi>(`/admin/promocoes/${promocaoId}`, { method: "PATCH", body: JSON.stringify(dados), headers: authHeader(token) });

// ── Combos ───────────────────────────────────────────────────────────────────

export type ComboItemApi = { produto_id: number; nome: string; quantidade: number };

export type ComboApi = {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  disponivel: boolean;
  itens: ComboItemApi[];
};

export type ComboCampos = {
  nome: string;
  slug: string;
  descricao?: string | null;
  preco: number;
  imagem_url?: string | null;
  disponivel: boolean;
  itens: { produto_id: number; quantidade: number }[];
};

export const getCombos = () => apiFetch<ComboApi[]>("/combos");

export const adminListarCombos = (token: string) => apiFetch<ComboApi[]>("/admin/combos", { headers: authHeader(token) });

export const adminCriarCombo = (token: string, dados: ComboCampos) =>
  apiFetch<ComboApi>("/admin/combos", { method: "POST", body: JSON.stringify(dados), headers: authHeader(token) });

export const adminAtualizarCombo = (token: string, comboId: number, dados: Partial<ComboCampos>) =>
  apiFetch<ComboApi>(`/admin/combos/${comboId}`, { method: "PATCH", body: JSON.stringify(dados), headers: authHeader(token) });

// ── Avaliações ───────────────────────────────────────────────────────────────

export type AvaliacaoApi = { id: number; usuario_nome: string; nota: number; comentario: string | null; criado_em: string };

export type AvaliacaoAdminApi = AvaliacaoApi & { pedido_id: number; aprovado: boolean };

export const getAvaliacoes = () => apiFetch<AvaliacaoApi[]>("/avaliacoes");

export const criarAvaliacao = (token: string, dados: { pedido_id: number; nota: number; comentario?: string }) =>
  apiFetch<AvaliacaoApi>("/avaliacoes", { method: "POST", body: JSON.stringify(dados), headers: authHeader(token) });

export const adminListarAvaliacoes = (token: string) => apiFetch<AvaliacaoAdminApi[]>("/admin/avaliacoes", { headers: authHeader(token) });

export const adminModerarAvaliacao = (token: string, avaliacaoId: number, aprovado: boolean) =>
  apiFetch<AvaliacaoAdminApi>(`/admin/avaliacoes/${avaliacaoId}`, {
    method: "PATCH",
    body: JSON.stringify({ aprovado }),
    headers: authHeader(token),
  });

// ── Mesas Virtuais ("Network da Fome") ───────────────────────────────────

export const getMesasVirtuais = (tema?: TemaMesaVirtual) => {
  const query = tema ? `?tema=${encodeURIComponent(tema)}` : "";
  return apiFetch<MesaVirtualApi[]>(`/mesas-virtuais${query}`);
};

export const getMinhaMesaVirtual = (token: string) =>
  apiFetch<MesaVirtualDetalheApi | null>("/mesas-virtuais/minha-mesa", { headers: authHeader(token) });

export const getMesaVirtual = (mesaVirtualId: number, token?: string) =>
  apiFetch<MesaVirtualDetalheApi>(`/mesas-virtuais/${mesaVirtualId}`, token ? { headers: authHeader(token) } : {});

export const sentarMesaVirtual = (token: string, mesaVirtualId: number, lugarNumero?: number) =>
  apiFetch<MesaVirtualDetalheApi>(`/mesas-virtuais/${mesaVirtualId}/sentar`, {
    method: "POST",
    body: JSON.stringify({ lugar_numero: lugarNumero ?? null }),
    headers: authHeader(token),
  });

export const sairMesaVirtual = (token: string, mesaVirtualId: number) =>
  apiFetch<void>(`/mesas-virtuais/${mesaVirtualId}/sair`, { method: "POST", headers: authHeader(token) });

export const getMensagensMesaVirtual = (token: string, mesaVirtualId: number, limite = 50) =>
  apiFetch<MensagemMesaVirtualApi[]>(`/mesas-virtuais/${mesaVirtualId}/mensagens?limite=${limite}`, {
    headers: authHeader(token),
  });

export const denunciarUsuarioMesaVirtual = (
  token: string,
  mesaVirtualId: number,
  dados: { denunciado_usuario_id: number; motivo: string; mensagem_id?: number },
) =>
  apiFetch<{ mensagem: string }>(`/mesas-virtuais/${mesaVirtualId}/denunciar`, {
    method: "POST",
    body: JSON.stringify(dados),
    headers: authHeader(token),
  });

export const listarBloqueios = (token: string) =>
  apiFetch<{ usuario_id: number; nome: string }[]>("/mesas-virtuais/bloqueios/listar", { headers: authHeader(token) });

export const bloquearUsuario = (token: string, bloqueadoUsuarioId: number) =>
  apiFetch<{ mensagem: string }>("/mesas-virtuais/bloqueios", {
    method: "POST",
    body: JSON.stringify({ bloqueado_usuario_id: bloqueadoUsuarioId }),
    headers: authHeader(token),
  });

export const desbloquearUsuario = (token: string, bloqueadoUsuarioId: number) =>
  apiFetch<void>(`/mesas-virtuais/bloqueios/${bloqueadoUsuarioId}`, { method: "DELETE", headers: authHeader(token) });

export function wsMesaVirtualUrl(mesaVirtualId: number, token: string): string {
  return `${wsBase()}/ws/mesas-virtuais/${mesaVirtualId}?token=${encodeURIComponent(token)}`;
}

export function wsSalaoUrl(): string {
  return `${wsBase()}/ws/mesas-virtuais/salao`;
}

// ── Moderação de Mesas Virtuais (painel do dono) ────────────────────────────

export const adminListarMesasVirtuais = (token: string) =>
  apiFetch<MesaVirtualAdminApi[]>("/admin/mesas-virtuais", { headers: authHeader(token) });

export const adminListarDenuncias = (token: string, statusFiltro?: "pendente" | "analisada") => {
  const query = statusFiltro ? `?status=${statusFiltro}` : "";
  return apiFetch<DenunciaAdminApi[]>(`/admin/mesas-virtuais/denuncias${query}`, { headers: authHeader(token) });
};

export const adminMarcarDenuncia = (token: string, denunciaId: number, statusNovo: "pendente" | "analisada") =>
  apiFetch<DenunciaAdminApi>(`/admin/mesas-virtuais/denuncias/${denunciaId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: statusNovo }),
    headers: authHeader(token),
  });

export const adminRemoverMensagemMesaVirtual = (token: string, mensagemId: number) =>
  apiFetch<void>(`/admin/mesas-virtuais/mensagens/${mensagemId}`, { method: "DELETE", headers: authHeader(token) });

export const adminBanirUsuarioMesaVirtual = (token: string, usuarioId: number, motivo?: string) =>
  apiFetch<{ mensagem: string }>(`/admin/mesas-virtuais/usuarios/${usuarioId}/banir`, {
    method: "POST",
    body: JSON.stringify({ motivo: motivo ?? null }),
    headers: authHeader(token),
  });

export const adminDesbanirUsuarioMesaVirtual = (token: string, usuarioId: number) =>
  apiFetch<void>(`/admin/mesas-virtuais/usuarios/${usuarioId}/banir`, { method: "DELETE", headers: authHeader(token) });


// ── G.P.T. (Grill Potato Toast) ────────────────────────────────────────────

export type GptMensagem = { autor: "cliente" | "gpt"; texto: string };

/** Diz se a IA está configurada no servidor (o botão só aparece se sim). */
export const gptStatus = () => apiFetch<{ disponivel: boolean }>("/gpt/status");

/** Envia as últimas trocas e devolve a resposta do atendente. */
export const gptConversar = (mensagens: GptMensagem[]) =>
  apiFetch<{ resposta: string; disponivel: boolean }>("/gpt/conversar", {
    method: "POST",
    body: JSON.stringify({ mensagens }),
  });

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Users, Wifi, WifiOff, X } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { useAdminWebSocket } from "@/app/hooks/useAdminWebSocket";
import { adminAlterarStatusPedido, adminFecharComanda, adminListarMesas, adminListarPedidos } from "@/app/lib/api";
import { AdminAvaliacoesPanel } from "@/app/pages/admin/AdminAvaliacoesPanel";
import { AdminCardapioPanel } from "@/app/pages/admin/AdminCardapioPanel";
import { AdminCombosPanel } from "@/app/pages/admin/AdminCombosPanel";
import { AdminCuponsPanel } from "@/app/pages/admin/AdminCuponsPanel";
import { AdminMesasVirtuaisPanel } from "@/app/pages/admin/AdminMesasVirtuaisPanel";
import { AdminPromocoesPanel } from "@/app/pages/admin/AdminPromocoesPanel";
import { AdminRelatoriosPanel } from "@/app/pages/admin/AdminRelatoriosPanel";
// MesaAdminApi é definido em lib/api.ts (é um alias de MesaComandaApi), não em
// types.ts — importar do lugar errado quebrava a checagem de tipos.
import type { MesaAdminApi } from "@/app/lib/api";
import type { PedidoAdminApi, StatusPedido } from "@/app/types";

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_OPCOES: StatusPedido[] = ["pendente", "confirmado", "em_preparo", "saiu_para_entrega", "pronto", "entregue", "cancelado"];

const STATUS_MESA_COR: Record<string, string> = {
  livre: "bg-accent/15 text-accent border-accent/30",
  ocupada: "bg-primary/15 text-primary border-primary/30",
  reservada: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  inativa: "bg-muted-foreground/10 text-muted-foreground border-border",
};

export function AdminDashboardPage() {
  const { token, administrador } = useAdminAuth();
  const [mesas, setMesas] = useState<MesaAdminApi[]>([]);
  const [pedidos, setPedidos] = useState<PedidoAdminApi[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "entrega" | "retirada">("todos");
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaAdminApi | null>(null);
  const [metodoFechamento, setMetodoFechamento] = useState("pix");
  const [fechando, setFechando] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [aba, setAba] = useState<
    "operacao" | "cardapio" | "combos" | "cupons" | "promocoes" | "avaliacoes" | "mesas_virtuais" | "relatorios"
  >("operacao");

  const recarregar = useCallback(() => {
    if (!token) return;
    adminListarMesas(token).then(setMesas).catch(() => {});
    adminListarPedidos(token, { tipo: filtroTipo === "todos" ? undefined : filtroTipo }).then(setPedidos).catch(() => {});
  }, [token, filtroTipo]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useAdminWebSocket(token, () => {
    setConectado(true);
    recarregar();
  });

  useEffect(() => {
    if (!token) return;
    setConectado(false);
    const id = setTimeout(() => setConectado(true), 500);
    return () => clearTimeout(id);
  }, [token]);

  const alterarStatus = async (pedidoId: number, status: StatusPedido) => {
    if (!token) return;
    const atualizado = await adminAlterarStatusPedido(token, pedidoId, status);
    setPedidos((p) => p.map((ped) => (ped.id === pedidoId ? atualizado : ped)));
  };

  const fecharComanda = async () => {
    if (!token || !mesaSelecionada?.comanda) return;
    setFechando(true);
    try {
      await adminFecharComanda(token, mesaSelecionada.comanda.id, metodoFechamento);
      setMesaSelecionada(null);
      recarregar();
    } finally {
      setFechando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex gap-1.5">
          {(
            [
              ["operacao", "Mesas & Pedidos"],
              ["cardapio", "Cardápio"],
              ["combos", "Combos"],
              ["cupons", "Cupons"],
              ["promocoes", "Promoções"],
              ["avaliacoes", "Avaliações"],
              ["mesas_virtuais", "🍔 Network da Fome"],
              ["relatorios", "Relatórios"],
            ] as const
          )
            .filter(([valor]) => valor !== "relatorios" || administrador?.papel === "admin")
            .map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setAba(valor)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                aba === valor ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
              }`}
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {conectado ? <Wifi size={14} className="text-accent" /> : <WifiOff size={14} />}
          {conectado ? "Atualizando em tempo real" : "Conectando…"}
        </div>
      </div>

      {aba === "cardapio" && <AdminCardapioPanel />}

      {aba === "combos" && <AdminCombosPanel />}

      {aba === "cupons" && <AdminCuponsPanel />}

      {aba === "promocoes" && <AdminPromocoesPanel />}

      {aba === "avaliacoes" && <AdminAvaliacoesPanel />}

      {aba === "mesas_virtuais" && <AdminMesasVirtuaisPanel />}

      {aba === "relatorios" && administrador?.papel === "admin" && <AdminRelatoriosPanel />}

      {aba === "operacao" && (
        <>
      {/* Mesas */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Mesas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {mesas.map((m) => (
            <button
              key={m.mesa.id}
              onClick={() => m.comanda && setMesaSelecionada(m)}
              disabled={!m.comanda}
              className={`border rounded-2xl p-4 text-left transition-colors ${STATUS_MESA_COR[m.mesa.status]} ${m.comanda ? "hover:brightness-110 cursor-pointer" : "cursor-default"}`}
            >
              <p className="font-bold text-lg" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                {m.mesa.numero}
              </p>
              <p className="text-[10px] font-mono uppercase mt-0.5" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                {m.mesa.status}
              </p>
              {m.comanda && <p className="text-xs font-bold mt-2">R$ {m.comanda.total.toFixed(2).replace(".", ",")}</p>}
            </button>
          ))}
        </div>
      </section>

      {/* Pedidos delivery/retirada */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Pedidos
          </h2>
          <div className="flex gap-1.5">
            {(["todos", "entrega", "retirada"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                  filtroTipo === t ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {pedidos.filter((p) => p.tipo !== "local").length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum pedido por aqui.</p>
          )}
          {pedidos
            .filter((p) => p.tipo !== "local")
            .map((pedido) => (
              <div key={pedido.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    #{pedido.id} · {pedido.tipo} · {pedido.usuario_nome ?? "—"}
                  </p>
                  <p className="text-sm font-bold mt-0.5">
                    {pedido.itens.map((i) => `${i.quantidade}x ${i.nome_produto}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-primary">R$ {pedido.total.toFixed(2).replace(".", ",")}</span>
                  <select
                    value={pedido.status}
                    onChange={(e) => alterarStatus(pedido.id, e.target.value as StatusPedido)}
                    className="bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-primary"
                  >
                    {STATUS_OPCOES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Painel de comanda da mesa */}
      {mesaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setMesaSelecionada(null)} />
          <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <h3 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  Mesa {mesaSelecionada.mesa.numero}
                </h3>
              </div>
              <button onClick={() => setMesaSelecionada(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            {mesaSelecionada.comanda && (
              <>
                <ul className="space-y-2.5 mb-5">
                  {mesaSelecionada.comanda.itens.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2.5">
                      <span>
                        {item.quantidade}x {item.nome_produto}
                      </span>
                      <span className="font-bold text-primary">R$ {item.subtotal.toFixed(2).replace(".", ",")}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between font-bold mb-5">
                  <span>Total</span>
                  <span className="text-xl text-primary">R$ {mesaSelecionada.comanda.total.toFixed(2).replace(".", ",")}</span>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-bold mb-1.5 block">Forma de pagamento</label>
                  <select
                    value={metodoFechamento}
                    onChange={(e) => setMetodoFechamento(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="pix">Pix</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="cartao_debito">Cartão de débito</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>

                <button
                  onClick={fecharComanda}
                  disabled={fechando}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 size={16} /> {fechando ? "Fechando…" : "Fechar comanda e registrar pagamento"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

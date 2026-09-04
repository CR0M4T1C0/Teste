import { useEffect, useState } from "react";
import { Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { adminRelatorios, type RelatorioApi } from "@/app/lib/api";

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

const TIPO_LABEL: Record<string, string> = { entrega: "Entrega", retirada: "Retirada", local: "Mesa" };
const METODO_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
};

const moeda = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const dataCurta = (iso: string) => {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
};

export function AdminRelatoriosPanel() {
  const { token } = useAdminAuth();
  const [dias, setDias] = useState(30);
  const [relatorio, setRelatorio] = useState<RelatorioApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    adminRelatorios(token, dias)
      .then(setRelatorio)
      .catch(() => setErro("Não foi possível carregar os relatórios."))
      .finally(() => setCarregando(false));
  }, [token, dias]);

  const maiorDia = Math.max(1, ...(relatorio?.faturamento_por_dia.map((d) => d.total) ?? [0]));
  const mostrarLabelDia = (relatorio?.faturamento_por_dia.length ?? 0) <= 14;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Relatórios
        </h2>
        <div className="flex gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                dias === p.dias ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="text-sm text-destructive text-center py-10">{erro}</p>}

      {carregando && !relatorio && <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>}

      {relatorio && (
        <>
          {/* Cartões de resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={18} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-mono uppercase" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  Faturamento
                </p>
                <p className="text-lg font-bold tabular-nums truncate" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  {moeda(relatorio.faturamento_total)}
                </p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Receipt size={18} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-mono uppercase" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  Ticket médio
                </p>
                <p className="text-lg font-bold tabular-nums truncate" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  {moeda(relatorio.ticket_medio)}
                </p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={18} className="text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-mono uppercase" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  Pedidos
                </p>
                <p className="text-lg font-bold tabular-nums truncate" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  {relatorio.total_pedidos}
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico de faturamento por dia */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <p className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wide">Faturamento por dia</p>
            {relatorio.faturamento_por_dia.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem pedidos nesse período.</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {relatorio.faturamento_por_dia.map((d) => (
                  <div key={d.data} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group min-w-0">
                    <div
                      title={`${dataCurta(d.data)}: ${moeda(d.total)}`}
                      className="w-full rounded-t-sm bg-primary/70 group-hover:bg-primary transition-colors"
                      style={{ height: `${Math.max(3, (d.total / maiorDia) * 100)}%` }}
                    />
                    {mostrarLabelDia && (
                      <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                        {dataCurta(d.data)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Produtos mais vendidos */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Mais vendidos</p>
              {relatorio.produtos_mais_vendidos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma venda no período.</p>
              ) : (
                <ul className="space-y-2.5">
                  {relatorio.produtos_mais_vendidos.map((p, i) => (
                    <li key={p.nome_produto} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground font-mono w-4 flex-shrink-0" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                          {i + 1}
                        </span>
                        <span className="truncate">{p.nome_produto}</span>
                      </span>
                      <span className="text-xs font-bold text-muted-foreground tabular-nums flex-shrink-0 ml-2">{p.quantidade}x</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Faturamento por tipo + pagamentos */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Por tipo de pedido</p>
              <ul className="space-y-2 mb-4">
                {relatorio.faturamento_por_tipo.map((t) => (
                  <li key={t.tipo} className="flex items-center justify-between text-sm">
                    <span>{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                    <span className="font-bold tabular-nums">{moeda(t.total)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Formas de pagamento</p>
              <div className="flex flex-wrap gap-1.5">
                {relatorio.pagamentos_por_metodo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem pagamentos registrados no período.</p>
                ) : (
                  relatorio.pagamentos_por_metodo.map((m) => (
                    <span key={m.metodo} className="text-xs font-bold px-2.5 py-1 rounded-full bg-secondary border border-border">
                      {METODO_LABEL[m.metodo] ?? m.metodo} · {moeda(m.total)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

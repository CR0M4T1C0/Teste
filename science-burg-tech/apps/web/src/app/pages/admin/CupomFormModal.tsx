import { useState } from "react";
import { X } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { ApiError, adminAtualizarCupom, adminCriarCupom, type CupomApi } from "@/app/lib/api";

export function CupomFormModal({ cupom, onClose, onSaved }: { cupom: CupomApi | null; onClose: () => void; onSaved: (c: CupomApi) => void }) {
  const { token } = useAdminAuth();

  const [codigo, setCodigo] = useState(cupom?.codigo ?? "");
  const [tipoDesconto, setTipoDesconto] = useState<"percentual" | "fixo">(cupom?.tipo_desconto ?? "percentual");
  const [valor, setValor] = useState(cupom ? String(cupom.valor) : "");
  const [valorMinimo, setValorMinimo] = useState(cupom ? String(cupom.valor_minimo_pedido) : "0");
  const [limiteTotal, setLimiteTotal] = useState(cupom?.limite_uso_total != null ? String(cupom.limite_uso_total) : "");
  const [limitePorUsuario, setLimitePorUsuario] = useState(cupom?.limite_uso_por_usuario != null ? String(cupom.limite_uso_por_usuario) : "");
  const [validoDe, setValidoDe] = useState(cupom?.valido_de ?? "");
  const [validoAte, setValidoAte] = useState(cupom?.valido_ate ?? "");
  const [ativo, setAtivo] = useState(cupom?.ativo ?? true);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErro(null);
    setSalvando(true);
    try {
      if (cupom) {
        const salvo = await adminAtualizarCupom(token, cupom.id, {
          tipo_desconto: tipoDesconto,
          valor: Number(valor.replace(",", ".")),
          valor_minimo_pedido: Number(valorMinimo.replace(",", ".") || 0),
          limite_uso_total: limiteTotal ? Number(limiteTotal) : null,
          limite_uso_por_usuario: limitePorUsuario ? Number(limitePorUsuario) : null,
          valido_de: validoDe || null,
          valido_ate: validoAte || null,
          ativo,
        });
        onSaved(salvo);
      } else {
        const salvo = await adminCriarCupom(token, {
          codigo,
          tipo_desconto: tipoDesconto,
          valor: Number(valor.replace(",", ".")),
          valor_minimo_pedido: Number(valorMinimo.replace(",", ".") || 0),
          limite_uso_total: limiteTotal ? Number(limiteTotal) : null,
          limite_uso_por_usuario: limitePorUsuario ? Number(limitePorUsuario) : null,
          valido_de: validoDe || null,
          valido_ate: validoAte || null,
          ativo,
        });
        onSaved(salvo);
      }
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o cupom.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            {cupom ? "Editar cupom" : "Novo cupom"}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {erro && <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold mb-1.5 block">Código</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              required
              disabled={!!cupom}
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary font-mono disabled:opacity-60"
              style={{ fontFamily: "'JetBrains Mono',monospace" }}
              placeholder="Ex: BEMVINDO10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Tipo</label>
              <select
                value={tipoDesconto}
                onChange={(e) => setTipoDesconto(e.target.value as "percentual" | "fixo")}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block">Valor</label>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                inputMode="decimal"
                placeholder={tipoDesconto === "percentual" ? "Ex: 10" : "Ex: 5,00"}
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block">Pedido mínimo (R$, opcional)</label>
            <input
              value={valorMinimo}
              onChange={(e) => setValorMinimo(e.target.value)}
              inputMode="decimal"
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Limite de usos total</label>
              <input
                value={limiteTotal}
                onChange={(e) => setLimiteTotal(e.target.value)}
                inputMode="numeric"
                placeholder="Sem limite"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block">Limite por cliente</label>
              <input
                value={limitePorUsuario}
                onChange={(e) => setLimitePorUsuario(e.target.value)}
                inputMode="numeric"
                placeholder="Sem limite"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block">Válido de</label>
              <input
                value={validoDe}
                onChange={(e) => setValidoDe(e.target.value)}
                type="date"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold mb-1.5 block">Válido até</label>
              <input
                value={validoAte}
                onChange={(e) => setValidoAte(e.target.value)}
                type="date"
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAtivo((a) => !a)}
            className={`w-full py-2.5 rounded-xl text-sm font-bold border transition-colors ${
              ativo ? "bg-accent/15 border-accent/30 text-accent" : "bg-secondary border-border text-muted-foreground"
            }`}
          >
            {ativo ? "Ativo" : "Inativo"}
          </button>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-full mt-6 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
        >
          {salvando ? "Salvando…" : cupom ? "Salvar alterações" : "Criar cupom"}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { adminAtualizarCombo, adminListarCombos, type ComboApi } from "@/app/lib/api";
import { ComboFormModal } from "@/app/pages/admin/ComboFormModal";

export function AdminCombosPanel() {
  const { token } = useAdminAuth();
  const [combos, setCombos] = useState<ComboApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ComboApi | null>(null);

  useEffect(() => {
    if (!token) return;
    adminListarCombos(token).then((lista) => {
      setCombos(lista);
      setCarregando(false);
    });
  }, [token]);

  const onSaved = (combo: ComboApi) => {
    setCombos((prev) => (prev.some((c) => c.id === combo.id) ? prev.map((c) => (c.id === combo.id ? combo : c)) : [...prev, combo]));
  };

  const alternarDisponibilidade = async (combo: ComboApi) => {
    if (!token) return;
    const atualizado = await adminAtualizarCombo(token, combo.id, { disponivel: !combo.disponivel });
    setCombos((prev) => prev.map((c) => (c.id === combo.id ? atualizado : c)));
  };

  if (carregando) return <p className="text-sm text-muted-foreground text-center py-12">Carregando combos…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Combos
        </h2>
        <button
          onClick={() => {
            setEditando(null);
            setModalAberto(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> Novo combo
        </button>
      </div>

      {combos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum combo criado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {combos.map((combo) => (
            <div key={combo.id} className="bg-card border border-border rounded-2xl overflow-hidden flex gap-3 p-3">
              <div className="w-16 h-16 rounded-xl bg-secondary flex-shrink-0 overflow-hidden">
                {combo.imagem_url && <img src={combo.imagem_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{combo.nome}</p>
                <p className="text-xs text-primary font-bold mt-0.5">R$ {combo.preco.toFixed(2).replace(".", ",")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{combo.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(" + ")}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => alternarDisponibilidade(combo)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      combo.disponivel ? "bg-accent/15 text-accent" : "bg-muted-foreground/10 text-muted-foreground"
                    }`}
                  >
                    {combo.disponivel ? "Disponível" : "Indisponível"}
                  </button>
                  <button
                    onClick={() => {
                      setEditando(combo);
                      setModalAberto(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && <ComboFormModal combo={editando} onClose={() => setModalAberto(false)} onSaved={onSaved} />}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Plus, Ticket } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { adminAtualizarCupom, adminListarCupons, type CupomApi } from "@/app/lib/api";
import { CupomFormModal } from "@/app/pages/admin/CupomFormModal";

export function AdminCuponsPanel() {
  const { token } = useAdminAuth();
  const [cupons, setCupons] = useState<CupomApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<CupomApi | null>(null);

  useEffect(() => {
    if (!token) return;
    adminListarCupons(token).then((lista) => {
      setCupons(lista);
      setCarregando(false);
    });
  }, [token]);

  const onSaved = (cupom: CupomApi) => {
    setCupons((prev) => (prev.some((c) => c.id === cupom.id) ? prev.map((c) => (c.id === cupom.id ? cupom : c)) : [cupom, ...prev]));
  };

  const alternarAtivo = async (cupom: CupomApi) => {
    if (!token) return;
    const atualizado = await adminAtualizarCupom(token, cupom.id, { ativo: !cupom.ativo });
    setCupons((prev) => prev.map((c) => (c.id === cupom.id ? atualizado : c)));
  };

  if (carregando) return <p className="text-sm text-muted-foreground text-center py-12">Carregando cupons…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Cupons
        </h2>
        <button
          onClick={() => {
            setEditando(null);
            setModalAberto(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> Novo cupom
        </button>
      </div>

      {cupons.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhum cupom criado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cupons.map((cupom) => (
            <div key={cupom.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ticket size={14} className="text-primary" />
                <p className="text-sm font-bold font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  {cupom.codigo}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {cupom.tipo_desconto === "percentual" ? `${cupom.valor}% de desconto` : `R$ ${cupom.valor.toFixed(2).replace(".", ",")} de desconto`}
                {cupom.valor_minimo_pedido > 0 && ` · pedido mín. R$ ${cupom.valor_minimo_pedido.toFixed(2).replace(".", ",")}`}
              </p>
              <button
                onClick={() => alternarAtivo(cupom)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  cupom.ativo ? "bg-accent/15 text-accent" : "bg-muted-foreground/10 text-muted-foreground"
                }`}
              >
                {cupom.ativo ? "Ativo" : "Inativo"}
              </button>
              <button
                onClick={() => {
                  setEditando(cupom);
                  setModalAberto(true);
                }}
                className="text-[10px] font-bold px-2 py-0.5 ml-2 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground"
              >
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {modalAberto && <CupomFormModal cupom={editando} onClose={() => setModalAberto(false)} onSaved={onSaved} />}
    </div>
  );
}

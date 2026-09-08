import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { adminAtualizarPromocao, adminListarPromocoes, type PromocaoAdminApi } from "@/app/lib/api";
import { PromocaoFormModal } from "@/app/pages/admin/PromocaoFormModal";

export function AdminPromocoesPanel() {
  const { token } = useAdminAuth();
  const [promocoes, setPromocoes] = useState<PromocaoAdminApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<PromocaoAdminApi | null>(null);

  useEffect(() => {
    if (!token) return;
    adminListarPromocoes(token).then((lista) => {
      setPromocoes(lista);
      setCarregando(false);
    });
  }, [token]);

  const onSaved = (promocao: PromocaoAdminApi) => {
    setPromocoes((prev) => (prev.some((p) => p.id === promocao.id) ? prev.map((p) => (p.id === promocao.id ? promocao : p)) : [...prev, promocao]));
  };

  const alternarAtivo = async (promocao: PromocaoAdminApi) => {
    if (!token) return;
    const atualizado = await adminAtualizarPromocao(token, promocao.id, { ativo: !promocao.ativo });
    setPromocoes((prev) => prev.map((p) => (p.id === promocao.id ? atualizado : p)));
  };

  if (carregando) return <p className="text-sm text-muted-foreground text-center py-12">Carregando promoções…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Promoções
        </h2>
        <button
          onClick={() => {
            setEditando(null);
            setModalAberto(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> Nova promoção
        </button>
      </div>

      {promocoes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhuma promoção criada ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {promocoes.map((promocao) => (
            <div key={promocao.id} className="bg-card border border-border rounded-2xl overflow-hidden flex gap-3 p-3">
              <div className="w-16 h-16 rounded-xl bg-secondary flex-shrink-0 overflow-hidden">
                <img src={promocao.imagem_url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{promocao.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ordem: {promocao.ordem}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => alternarAtivo(promocao)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      promocao.ativo ? "bg-accent/15 text-accent" : "bg-muted-foreground/10 text-muted-foreground"
                    }`}
                  >
                    {promocao.ativo ? "Ativa" : "Inativa"}
                  </button>
                  <button
                    onClick={() => {
                      setEditando(promocao);
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

      {modalAberto && <PromocaoFormModal promocao={editando} onClose={() => setModalAberto(false)} onSaved={onSaved} />}
    </div>
  );
}

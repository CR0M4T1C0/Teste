import { useEffect, useState } from "react";
import { Check, Star, X } from "lucide-react";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { adminListarAvaliacoes, adminModerarAvaliacao, type AvaliacaoAdminApi } from "@/app/lib/api";

export function AdminAvaliacoesPanel() {
  const { token } = useAdminAuth();
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAdminApi[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!token) return;
    adminListarAvaliacoes(token).then((lista) => {
      setAvaliacoes(lista);
      setCarregando(false);
    });
  }, [token]);

  const moderar = async (avaliacao: AvaliacaoAdminApi, aprovado: boolean) => {
    if (!token) return;
    const atualizado = await adminModerarAvaliacao(token, avaliacao.id, aprovado);
    setAvaliacoes((prev) => prev.map((a) => (a.id === avaliacao.id ? atualizado : a)));
  };

  if (carregando) return <p className="text-sm text-muted-foreground text-center py-12">Carregando avaliações…</p>;

  const pendentes = avaliacoes.filter((a) => !a.aprovado);
  const aprovadas = avaliacoes.filter((a) => a.aprovado);

  const Card = ({ a }: { a: AvaliacaoAdminApi }) => (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold">{a.usuario_nome}</p>
        <div className="flex gap-0.5">
          {Array.from({ length: a.nota }).map((_, i) => (
            <Star key={i} size={12} className="fill-yellow-400 text-yellow-400" />
          ))}
        </div>
      </div>
      {a.comentario && <p className="text-xs text-muted-foreground mb-3">"{a.comentario}"</p>}
      <p className="text-[10px] text-muted-foreground font-mono mb-3" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
        pedido #{a.pedido_id} · {new Date(a.criado_em).toLocaleDateString("pt-BR")}
      </p>
      {a.aprovado ? (
        <button
          onClick={() => moderar(a, false)}
          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-muted-foreground/10 text-muted-foreground hover:text-foreground"
        >
          <X size={11} /> Ocultar
        </button>
      ) : (
        <button
          onClick={() => moderar(a, true)}
          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent/15 text-accent hover:bg-accent/25"
        >
          <Check size={11} /> Aprovar
        </button>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-bold mb-5" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
        Avaliações
      </h2>

      <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Pendentes de aprovação ({pendentes.length})</p>
      {pendentes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 mb-8">Nenhuma avaliação pendente.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {pendentes.map((a) => (
            <Card key={a.id} a={a} />
          ))}
        </div>
      )}

      <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Aprovadas ({aprovadas.length})</p>
      {aprovadas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhuma avaliação aprovada ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {aprovadas.map((a) => (
            <Card key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Star, X } from "lucide-react";
import { ApiError, criarAvaliacao } from "@/app/lib/api";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";

export function AvaliarPedidoModal({
  pedidoId,
  onClose,
  onEnviada,
}: {
  pedidoId: number;
  onClose: () => void;
  onEnviada: () => void;
}) {
  const { token } = useClienteAuth();
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    if (!token) return;
    setEnviando(true);
    setErro(null);
    try {
      await criarAvaliacao(token, { pedido_id: pedidoId, nota, comentario: comentario.trim() || undefined });
      onEnviada();
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível enviar sua avaliação agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Avaliar pedido
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setNota(n)}>
              <Star size={30} className={n <= nota ? "fill-yellow-400 text-yellow-400" : "text-border"} />
            </button>
          ))}
        </div>

        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
          placeholder="Conte como foi a sua experiência (opcional)"
          className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none mb-4"
        />

        {erro && <p className="mb-4 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

        <button
          onClick={enviar}
          disabled={enviando}
          className="w-full py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
        >
          {enviando ? "Enviando…" : "Enviar avaliação"}
        </button>
        <p className="mt-3 text-center text-[10px] text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
          // sua avaliação passa por moderação antes de aparecer no site
        </p>
      </div>
    </div>
  );
}

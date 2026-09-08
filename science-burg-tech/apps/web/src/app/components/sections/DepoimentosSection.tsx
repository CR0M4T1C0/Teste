import { Star } from "lucide-react";
import { FadeUp } from "@/app/components/common/FadeUp";
import { useAvaliacoes } from "@/app/hooks/useAvaliacoes";

export function DepoimentosSection() {
  const { avaliacoes, carregando, erro } = useAvaliacoes();

  // Sem avaliação aprovada ainda (ou erro ao buscar) — a seção some, em vez
  // de mostrar um bloco vazio ou um erro visível pro cliente final.
  if (erro || (!carregando && avaliacoes.length === 0)) return null;

  return (
    <section className="py-16 border-y border-border bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            O que os <span className="text-primary">devs dizem</span>
          </h2>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {carregando
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                  <div className="h-3 w-20 rounded bg-secondary mb-3" />
                  <div className="h-3 w-full rounded bg-secondary mb-2" />
                  <div className="h-3 w-4/5 rounded bg-secondary mb-4" />
                  <div className="flex items-center gap-2.5 pt-3 border-t border-border">
                    <div className="w-8 h-8 rounded-full bg-secondary" />
                    <div className="h-3 w-24 rounded bg-secondary" />
                  </div>
                </div>
              ))
            : avaliacoes.map((r, i) => (
                <FadeUp key={r.id} delay={i * 0.1}>
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex gap-0.5 mb-3">
                      {Array(r.nota)
                        .fill(null)
                        .map((_, j) => (
                          <Star key={j} size={13} className="fill-yellow-400 text-yellow-400" />
                        ))}
                    </div>
                    {r.comentario && <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{r.comentario}"</p>}
                    <div className="flex items-center gap-2.5 pt-3 border-t border-border">
                      <div
                        className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs"
                        style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                      >
                        {r.usuario_nome[0]}
                      </div>
                      <p className="text-xs font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                        {r.usuario_nome}
                      </p>
                    </div>
                  </div>
                </FadeUp>
              ))}
        </div>
      </div>
    </section>
  );
}

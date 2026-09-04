import { Star } from "lucide-react";
import { FadeUp } from "@/app/components/common/FadeUp";

const DEPOIMENTOS = [
  { nome: "Rafael S.", cargo: "Senior Dev", stars: 5, txt: "O GitHub Burger é incrível. Two commits of flavor in every bite. Venho toda semana!" },
  { nome: "Camila T.", cargo: "UX Designer", stars: 5, txt: "Ambiente perfeito pra trabalhar e comer. Wi-Fi rápido, tomadas em todas as mesas e o melhor cookie overflow da vida." },
  { nome: "Lucas M.", cargo: "DevOps Engineer", stars: 5, txt: "O C++ Burger é picante como um memory leak. Mas vale cada byte. Entrega sempre dentro do SLA." },
];

export function DepoimentosSection() {
  return (
    <section className="py-16 border-y border-border bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            O que os <span className="text-primary">devs dizem</span>
          </h2>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {DEPOIMENTOS.map((r, i) => (
            <FadeUp key={r.nome} delay={i * 0.1}>
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex gap-0.5 mb-3">
                  {Array(r.stars)
                    .fill(null)
                    .map((_, j) => (
                      <Star key={j} size={13} className="fill-yellow-400 text-yellow-400" />
                    ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{r.txt}"</p>
                <div className="flex items-center gap-2.5 pt-3 border-t border-border">
                  <div
                    className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs"
                    style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                  >
                    {r.nome[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      {r.nome}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.cargo}</p>
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

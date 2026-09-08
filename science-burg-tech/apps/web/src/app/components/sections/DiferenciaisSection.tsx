import { Award, Star, Wifi, Zap } from "lucide-react";
import { FadeUp } from "@/app/components/common/FadeUp";

const DIFERENCIAIS = [
  { icon: <Wifi size={22} className="text-accent" />, titulo: "Wi-Fi Gratuito", desc: "Para devs que trabalham enquanto comem" },
  { icon: <Zap size={22} className="text-primary" />, titulo: "Entrega Rápida", desc: "18 minutos em média. Sem downtime." },
  { icon: <Award size={22} className="text-yellow-400" />, titulo: "Ingredientes Premium", desc: "Selecionados como boas dependências" },
  { icon: <Star size={22} className="text-primary" />, titulo: "4.9 de Avaliação", desc: "+1.200 reviews verificados no iFood" },
];

export function DiferenciaisSection() {
  return (
    <section className="py-16 border-y border-border bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {DIFERENCIAIS.map((d, i) => (
            <FadeUp key={d.titulo} delay={i * 0.1}>
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 h-full">
                {d.icon}
                <p className="font-bold text-foreground text-sm" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  {d.titulo}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

import { Code2, Cpu, FlaskConical, UtensilsCrossed } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { FadeUp } from "@/app/components/common/FadeUp";
import salaoPng from "@/imports/1000217326.png";

const STATS = [["2020", "Fundada"], ["14", "Receitas"], ["4.9★", "iFood"]];

const FEATURES = [
  { icon: <Code2 size={16} className="text-primary" />, t: "Receitas Versionadas", d: "Cada burger tem seu próprio changelog e release notes" },
  { icon: <FlaskConical size={16} className="text-accent" />, t: "Ingredientes Premium", d: "Selecionados como dependências de qualidade comprovada" },
  { icon: <UtensilsCrossed size={16} className="text-primary" />, t: "Ambiente Tech", d: "Mesas interativas com Wi-Fi e tomadas para todos" },
];

export function SobreSection() {
  return (
    <section id="sobre" className="py-20">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <FadeUp>
          <div className="relative rounded-3xl overflow-hidden bg-secondary border border-border shadow-2xl">
            <ImageWithFallback src={salaoPng} alt="Salão Science Burg Tech com mesas interativas e neons" className="w-full h-[420px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            {/* Badge overlay */}
            <div className="absolute bottom-5 left-5 right-5">
              <div className="bg-background/80 backdrop-blur-md border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <Cpu size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    // status.live
                  </p>
                  <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                    8 mesas disponíveis agora
                  </p>
                </div>
                <span className="ml-auto w-2.5 h-2.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
              </div>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.15}>
          <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            // readme.sobre.md
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-none mb-6" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            A paixão por tech
            <br />
            <span className="text-primary">tem sabor.</span>
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            A <strong className="text-foreground">Science Burg Tech</strong> une a paixão por tecnologia e alta gastronomia. Nossa cozinha é
            otimizada para atender programadores, geeks e entusiastas com a melhor qualidade — porque sabemos que o seu tempo de compilação é
            valioso.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Cada hambúrguer é um projeto open-source de sabor: ingredientes selecionados, receitas versionadas e um ambiente onde você pode comer
            enquanto escreve código. Infraestrutura projetada para zero downtime.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {STATS.map(([n, l]) => (
              <div key={l} className="bg-secondary border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  {n}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{l}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex items-start gap-3 p-3 rounded-xl hover:bg-secondary transition-colors">
                <div className="mt-0.5 flex-shrink-0">{f.icon}</div>
                <div>
                  <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                    {f.t}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

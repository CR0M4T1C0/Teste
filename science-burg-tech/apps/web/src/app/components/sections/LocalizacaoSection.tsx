import { motion } from "motion/react";
import { ArrowRight, Clock, MapPin, Phone } from "lucide-react";
import { FadeUp } from "@/app/components/common/FadeUp";

const INFO_CARDS = [
  { icon: <MapPin size={18} className="text-primary" />, t: "Endereço", ls: ["Rua Algoritmo, 404", "Bairro Silicon Valley", "Rio de Janeiro — RJ", "CEP: 20.040-404"] },
  { icon: <Phone size={18} className="text-primary" />, t: "Contato", ls: ["(21) 99999-4040", "WhatsApp disponível", "contato@scienceburg.tech"] },
  { icon: <Clock size={18} className="text-primary" />, t: "Horário de Funcionamento", ls: ["Seg a Sáb: 18h às 23h", "Domingo: 18h às 22h", "Delivery: todos os dias"] },
];

export function LocalizacaoSection() {
  return (
    <section id="localizacao" className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="text-center mb-12">
          <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            // location.config
          </p>
          <h2 className="text-4xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Nos <span className="text-primary">Encontre</span>
          </h2>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Mapa estilizado */}
          <FadeUp className="lg:col-span-3">
            <div className="relative rounded-3xl overflow-hidden border border-border bg-secondary h-72 lg:h-full min-h-64">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,94,26,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,94,26,0.07) 1px,transparent 1px)",
                  backgroundSize: "48px 48px",
                }}
              />
              {/* Pulso central */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="absolute inset-0 rounded-full bg-primary/20"
                  />
                  <div className="w-14 h-14 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center relative z-10">
                    <MapPin size={24} className="text-primary" />
                  </div>
                </div>
                <p className="mt-4 font-bold text-foreground text-lg" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  Silicon Valley, RJ
                </p>
                <p className="text-sm text-muted-foreground" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  Rua Algoritmo, 404
                </p>
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-sm text-accent border border-accent/30 px-5 py-2.5 rounded-xl hover:bg-accent/10 transition-colors font-medium"
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  Abrir no Google Maps <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </FadeUp>

          {/* Info cards */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {INFO_CARDS.map((b, i) => (
              <FadeUp key={b.t} delay={i * 0.1}>
                <div className="bg-card border border-border rounded-2xl p-5 flex gap-4">
                  <div className="mt-0.5 flex-shrink-0">{b.icon}</div>
                  <div>
                    <p className="text-sm font-bold text-foreground mb-2" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      {b.t}
                    </p>
                    {b.ls.map((l) => (
                      <p key={l} className="text-xs text-muted-foreground leading-5">
                        {l}
                      </p>
                    ))}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

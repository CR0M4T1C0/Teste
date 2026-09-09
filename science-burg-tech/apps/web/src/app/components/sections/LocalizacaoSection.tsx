import { ArrowRight, Clock, MapPin, Phone } from "lucide-react";
import { FadeUp } from "@/app/components/common/FadeUp";

// Atualize este endereço quando tiver o endereço real da loja — o mapa
// abaixo busca exatamente por esse texto no Google Maps.
const ENDERECO_COMPLETO = "Rua Algoritmo, 404, Rio de Janeiro - RJ, 20040-404";
const MAPA_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(ENDERECO_COMPLETO)}&output=embed`;
const MAPA_LINK_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ENDERECO_COMPLETO)}`;

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
          {/* Mapa real */}
          <FadeUp className="lg:col-span-3">
            <div className="relative rounded-3xl overflow-hidden border border-border bg-secondary h-72 lg:h-full min-h-64">
              <iframe
                src={MAPA_EMBED_URL}
                title="Mapa de localização — burgtech"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full grayscale-[15%] contrast-[1.05]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent" />
              <a
                href={MAPA_LINK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 text-sm text-white bg-background/85 backdrop-blur-md border border-border px-5 py-2.5 rounded-xl hover:bg-background transition-colors font-medium"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                Abrir no Google Maps <ArrowRight size={14} />
              </a>
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

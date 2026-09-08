import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Ticket } from "lucide-react";
import { useCarousel } from "@/app/hooks/useCarousel";
import { usePromocoes } from "@/app/hooks/usePromocoes";

export function PromoBannerSection() {
  const reduzirMovimento = useReducedMotion();
  const { promocoes, carregando, erro } = usePromocoes();
  const { slide, goSlide } = useCarousel(Math.max(promocoes.length, 1), 6000, Boolean(reduzirMovimento));

  // Sem dado nenhum pra mostrar (erro, ou ninguém cadastrou promoção ainda)
  // — a seção simplesmente não aparece, em vez de mostrar um espaço vazio.
  if (erro || (!carregando && promocoes.length === 0)) return null;

  return (
    <section className="pt-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative h-56 md:h-72 rounded-3xl overflow-hidden border border-border bg-secondary">
          {carregando ? (
            <div className="absolute inset-0 animate-pulse bg-secondary" />
          ) : (
            <>
              {promocoes.map((promo, i) => (
                <motion.div
                  key={promo.id}
                  animate={{ opacity: i === slide ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  <img src={promo.imagem_url} alt={promo.titulo} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
                </motion.div>
              ))}

              <div className="relative z-10 h-full flex flex-col justify-center px-8 md:px-12 max-w-md">
                {promocoes[slide].cupom_codigo && (
                  <span
                    className="inline-flex items-center gap-1.5 w-fit text-[11px] font-bold px-3 py-1 rounded-full bg-primary text-white mb-3"
                    style={{ fontFamily: "'JetBrains Mono',monospace" }}
                  >
                    <Ticket size={12} /> {promocoes[slide].cupom_codigo}
                  </span>
                )}
                <h3
                  className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-1.5"
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  {promocoes[slide].titulo}
                </h3>
                {promocoes[slide].subtitulo && <p className="text-sm text-muted-foreground">{promocoes[slide].subtitulo}</p>}
              </div>

              {promocoes.length > 1 && (
                <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                  <button
                    onClick={() => goSlide((slide - 1 + promocoes.length) % promocoes.length)}
                    className="w-8 h-8 rounded-full bg-background/70 border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors backdrop-blur-sm"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {promocoes.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goSlide(i)}
                      className={`transition-all rounded-full ${i === slide ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-foreground/30 hover:bg-foreground/50"}`}
                    />
                  ))}
                  <button
                    onClick={() => goSlide((slide + 1) % promocoes.length)}
                    className="w-8 h-8 rounded-full bg-background/70 border border-border flex items-center justify-center text-foreground hover:bg-background transition-colors backdrop-blur-sm"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

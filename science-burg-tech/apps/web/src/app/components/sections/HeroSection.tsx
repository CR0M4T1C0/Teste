import { motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { HERO_SLIDES } from "@/app/data/menu";
import { useCardapio } from "@/app/hooks/useCardapio";
import { useHeroCarousel } from "@/app/hooks/useHeroCarousel";
import type { Item } from "@/app/types";

export function HeroSection({ onAdd }: { onAdd: (i: Item) => void }) {
  const { slide, goSlide } = useHeroCarousel(HERO_SLIDES.length);
  const currentSlide = HERO_SLIDES[slide];
  const { todosItens } = useCardapio();
  const itemDestaque = todosItens.find((i) => i.slug === currentSlide.produtoSlug);

  return (
    <section className="relative h-[90vh] min-h-[560px] overflow-hidden bg-zinc-950">
      {/* Slides */}
      {HERO_SLIDES.map((s, i) => (
        <motion.div key={s.id} animate={{ opacity: i === slide ? 1 : 0 }} transition={{ duration: 0.8, ease: "easeInOut" }} className="absolute inset-0">
          <img src={s.img} alt={s.titulo} className="w-full h-full object-cover" />
          <div className={`absolute inset-0 bg-gradient-to-r ${s.cor} via-background/50 to-transparent`} />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </motion.div>
      ))}

      {/* Conteúdo do slide ativo */}
      <div className="relative z-10 h-full flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 items-center gap-8">
          <div>
            <motion.div
              key={`badge-${slide}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 text-xs text-accent border border-accent/30 bg-accent/10 px-3 py-1.5 rounded-full mb-5"
              style={{ fontFamily: "'JetBrains Mono',monospace" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Sistema online • Aceitando pedidos
            </motion.div>

            <motion.h1
              key={`h1-${slide}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl md:text-7xl font-bold leading-none tracking-tight mb-5 whitespace-pre-line"
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              <span className="text-foreground">{currentSlide.titulo.split("\n")[0]}</span>
              <br />
              <span className="text-primary">{currentSlide.titulo.split("\n")[1]}</span>
            </motion.h1>

            <motion.p
              key={`sub-${slide}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-muted-foreground text-base max-w-md mb-8 leading-relaxed"
            >
              {currentSlide.sub}
            </motion.p>

            <motion.div key={`cta-${slide}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="flex flex-wrap gap-3">
              <Link
                to="/cardapio"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 hover:-translate-y-0.5"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                {currentSlide.cta} <ArrowRight size={16} />
              </Link>
              <Link
                to="/sobre"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/20 text-foreground font-bold text-sm rounded-2xl hover:bg-white/5 transition-all"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                Nosso Espaço
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div key={`stats-${slide}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex gap-8 mt-12">
              {[["4.9★", "Avaliação"], ["+2mil", "Pedidos/mês"], ["18min", "Entrega"]].map(([n, l]) => (
                <div key={l}>
                  <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                    {n}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Card flutuante */}
          {itemDestaque && (
            <div className="hidden lg:flex justify-end">
              <motion.div
                key={`card-${slide}`}
                initial={{ opacity: 0, x: 40, rotate: 2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="bg-card/85 backdrop-blur-xl border border-border rounded-3xl p-6 w-72 shadow-2xl"
              >
                <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-secondary">
                  <img src={itemDestaque.img} alt={itemDestaque.nome} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                      ⭐ Destaque
                    </p>
                    <p className="font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      {itemDestaque.nome}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-primary" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                    R$ {itemDestaque.preco.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onAdd(itemDestaque)}
                  className="w-full mt-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  Adicionar ao Carrinho
                </motion.button>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Controles do carousel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        <button
          onClick={() => goSlide((slide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <ChevronLeft size={16} />
        </button>
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goSlide(i)}
            className={`transition-all rounded-full ${i === slide ? "w-8 h-2.5 bg-primary" : "w-2.5 h-2.5 bg-white/30 hover:bg-white/50"}`}
          />
        ))}
        <button
          onClick={() => goSlide((slide + 1) % HERO_SLIDES.length)}
          className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}

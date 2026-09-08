import { motion } from "motion/react";
import { Beef, CupSoda, IceCream2, Layers, Utensils, type LucideIcon } from "lucide-react";
import { FadeUp } from "@/app/components/common/FadeUp";
import { CardProduto } from "@/app/components/product/CardProduto";
import { ComboCard } from "@/app/components/product/ComboCard";
import { PromoBannerSection } from "@/app/components/sections/PromoBannerSection";
import { useCardapio } from "@/app/hooks/useCardapio";
import { useCombos } from "@/app/hooks/useCombos";
import type { Cat, Combo, Item } from "@/app/types";

export type CategoriaOuCombo = Cat | "combo";

const ICONE_CATEGORIA: Record<Cat, LucideIcon> = {
  hamburguer: Beef,
  acompanhamento: Utensils,
  bebida: CupSoda,
  sobremesa: IceCream2,
};

export function CardapioSection({
  cat,
  onChangeCat,
  onAdd,
  onAddCombo,
}: {
  cat: CategoriaOuCombo;
  onChangeCat: (c: CategoriaOuCombo) => void;
  onAdd: (i: Item) => void;
  onAddCombo: (c: Combo) => void;
}) {
  const { categorias: CATS, itensPorCategoria, todosItens, carregando, erro } = useCardapio();
  const { combos, carregando: carregandoCombos, erro: erroCombos } = useCombos();
  const itens = cat === "combo" ? [] : itensPorCategoria[cat] ?? [];
  const totalItens = todosItens.length;

  if (erro) {
    return (
      <section className="py-20">
        <p className="text-center text-sm text-muted-foreground">Não foi possível carregar o cardápio agora. Tente novamente em instantes.</p>
      </section>
    );
  }

  return (
    <section id="cardapio" className="py-20">
      <PromoBannerSection />

      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="text-center mb-12 mt-10">
          <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            // cardapio.json — {totalItens} itens
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Nosso <span className="text-primary">Cardápio</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
            Cada item cuidadosamente deployado para maximizar o seu prazer gastronômico.
          </p>
        </FadeUp>

        {/* Tabs */}
        <FadeUp delay={0.1} className="flex gap-2 overflow-x-auto mb-10 pb-1">
          {CATS.map((c) => {
            const Icone = ICONE_CATEGORIA[c.id];
            const ativa = cat === c.id;
            return (
              <motion.button
                key={c.id}
                onClick={() => onChangeCat(c.id)}
                whileTap={{ scale: 0.96 }}
                className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-shadow ${
                  ativa ? "text-white shadow-lg shadow-primary/30" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                {ativa && (
                  <motion.span layoutId="tabBg" className="absolute inset-0 bg-primary rounded-2xl" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icone size={16} />
                  {c.label}
                </span>
              </motion.button>
            );
          })}

          {(carregandoCombos || combos.length > 0) && (
            <motion.button
              onClick={() => onChangeCat("combo")}
              whileTap={{ scale: 0.96 }}
              className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-shadow ${
                cat === "combo" ? "text-white shadow-lg shadow-primary/30" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              {cat === "combo" && (
                <motion.span layoutId="tabBg" className="absolute inset-0 bg-primary rounded-2xl" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Layers size={16} />
                Combos
              </span>
            </motion.button>
          )}
        </FadeUp>

        {/* Grid */}
        {cat === "combo" ? (
          erroCombos ? (
            <p className="text-center text-sm text-muted-foreground py-12">Não foi possível carregar os combos agora.</p>
          ) : carregandoCombos ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-52 bg-secondary" />
                  <div className="flex flex-col gap-3 p-5">
                    <div className="h-4 w-2/3 rounded bg-secondary" />
                    <div className="h-3 w-full rounded bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : combos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nenhum combo disponível no momento.</p>
          ) : (
            <motion.div key="combo" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {combos.map((combo, i) => (
                <FadeUp key={combo.id} delay={i * 0.07}>
                  <ComboCard combo={combo} onAdd={onAddCombo} />
                </FadeUp>
              ))}
            </motion.div>
          )
        ) : carregando ? (
          <p className="text-center text-sm text-muted-foreground py-12">Carregando cardápio…</p>
        ) : (
          <motion.div key={cat} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {itens.map((item, i) => (
              <FadeUp key={item.id} delay={i * 0.07}>
                <CardProduto item={item} onAdd={onAdd} />
              </FadeUp>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

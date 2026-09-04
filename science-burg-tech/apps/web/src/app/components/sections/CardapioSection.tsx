import { motion } from "motion/react";
import { FadeUp } from "@/app/components/common/FadeUp";
import { CardProduto } from "@/app/components/product/CardProduto";
import { useCardapio } from "@/app/hooks/useCardapio";
import type { Cat, Item } from "@/app/types";

export function CardapioSection({
  cat,
  onChangeCat,
  onAdd,
}: {
  cat: Cat;
  onChangeCat: (c: Cat) => void;
  onAdd: (i: Item) => void;
}) {
  const { categorias: CATS, itensPorCategoria, todosItens, carregando, erro } = useCardapio();
  const itens = itensPorCategoria[cat] ?? [];
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
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="text-center mb-12">
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
          {CATS.map((c) => (
            <motion.button
              key={c.id}
              onClick={() => onChangeCat(c.id)}
              whileTap={{ scale: 0.96 }}
              className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-colors ${
                cat === c.id ? "text-white" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              {cat === c.id && (
                <motion.span layoutId="tabBg" className="absolute inset-0 bg-primary rounded-2xl -z-10" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span>{c.emoji}</span> {c.label}
            </motion.button>
          ))}
        </FadeUp>

        {/* Grid */}
        {carregando ? (
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

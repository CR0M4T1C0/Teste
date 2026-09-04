import { motion } from "motion/react";
import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router";
import { FadeUp } from "@/app/components/common/FadeUp";
import { useCardapio } from "@/app/hooks/useCardapio";
import type { Item } from "@/app/types";

export function DestaquesSection({ onAdd }: { onAdd: (i: Item) => void }) {
  const { itensPorCategoria } = useCardapio();
  const hamburgueres = itensPorCategoria.hamburguer ?? [];

  if (hamburgueres.length === 0) return null;

  return (
    <section className="py-16 border-b border-border">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs text-accent mb-1" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              // mais_pedidos.js
            </p>
            <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Os <span className="text-primary">Mais Pedidos</span>
            </h2>
          </div>
          <Link to="/cardapio" className="hidden sm:flex items-center gap-1 text-sm text-primary hover:underline font-medium" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Ver tudo <ArrowRight size={14} />
          </Link>
        </FadeUp>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {hamburgueres.map((b, i) => (
            <FadeUp key={b.id} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl overflow-hidden bg-secondary border border-border group cursor-pointer aspect-[3/4]"
                onClick={() => onAdd(b)}
              >
                <img src={b.img} alt={b.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                {b.tag && (
                  <span
                    className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full text-white ${b.badge || "bg-primary"}`}
                    style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                  >
                    {b.tag}
                  </span>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-sm font-bold text-foreground leading-tight" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                    {b.nome}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-primary font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      R$ {b.preco.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={14} />
                    </span>
                  </div>
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

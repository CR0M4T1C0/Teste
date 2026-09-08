import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { FadeUp } from "@/app/components/common/FadeUp";
import { CardProduto } from "@/app/components/product/CardProduto";
import { useCardapio } from "@/app/hooks/useCardapio";
import type { Item } from "@/app/types";

export function CardapioPreviewSection({ onAdd }: { onAdd: (i: Item) => void }) {
  const { itensPorCategoria, carregando, erro } = useCardapio();
  const maisPedidos = (itensPorCategoria.hamburguer ?? []).slice(0, 3);

  if (erro) {
    return (
      <section id="cardapio" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground">Não foi possível carregar o cardápio agora. Tente novamente em instantes.</p>
        </div>
      </section>
    );
  }

  if (!carregando && maisPedidos.length === 0) return null;

  return (
    <section id="cardapio" className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        <FadeUp className="text-center mb-12">
          <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            // cardapio.json — mais_pedidos
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Nosso <span className="text-primary">Cardápio</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
            Uma prévia dos itens mais pedidos. Veja o cardápio completo para explorar tudo.
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
          {carregando
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-52 bg-secondary" />
                  <div className="flex flex-col gap-3 p-5">
                    <div className="h-4 w-2/3 rounded bg-secondary" />
                    <div className="h-3 w-full rounded bg-secondary" />
                    <div className="h-3 w-4/5 rounded bg-secondary" />
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
                      <div className="h-5 w-16 rounded bg-secondary" />
                      <div className="h-9 w-24 rounded-xl bg-secondary" />
                    </div>
                  </div>
                </div>
              ))
            : maisPedidos.map((item, i) => (
                <FadeUp key={item.id} delay={i * 0.08}>
                  <CardProduto item={item} onAdd={onAdd} />
                </FadeUp>
              ))}
        </div>

        <FadeUp className="flex justify-center">
          <Link
            to="/cardapio"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 hover:-translate-y-0.5"
            style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
          >
            Ver Cardápio Completo <ArrowRight size={16} />
          </Link>
        </FadeUp>
      </div>
    </section>
  );
}

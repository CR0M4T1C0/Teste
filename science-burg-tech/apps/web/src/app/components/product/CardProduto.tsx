import { useState } from "react";
import { motion } from "motion/react";
import { Check, Plus } from "lucide-react";
import type { Item } from "@/app/types";

export function CardProduto({ item, onAdd }: { item: Item; onAdd: (i: Item) => void }) {
  const [ok, setOk] = useState(false);
  const add = () => {
    onAdd(item);
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  };

  return (
    <motion.div
      whileHover={{ y: -6, boxShadow: "0 20px 60px rgba(255,94,26,0.18)" }}
      transition={{ duration: 0.25 }}
      className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col group cursor-pointer"
    >
      {/* Imagem */}
      <div className="relative h-52 overflow-hidden bg-secondary">
        <motion.img
          src={item.img}
          alt={item.nome}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.45 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-transparent to-transparent" />

        {item.tag && (
          <span
            className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full text-white ${item.badge || "bg-primary"}`}
            style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
          >
            {item.tag}
          </span>
        )}
        {item.kcal != null && (
          <span
            className="absolute top-3 right-3 text-[10px] font-mono px-2 py-1 rounded-lg bg-background/70 backdrop-blur-sm border border-border/60 text-muted-foreground"
            style={{ fontFamily: "'JetBrains Mono',monospace" }}
          >
            {item.kcal} kcal
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <h3
            className="text-lg font-bold text-foreground leading-tight mb-1.5"
            style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
          >
            {item.nome}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.descricao}</p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
          <span className="text-xl font-bold text-primary" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            R$ {item.preco.toFixed(2).replace(".", ",")}
          </span>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={add}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              ok ? "bg-accent text-background" : "bg-primary text-white hover:bg-primary/90"
            }`}
            style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
          >
            {ok ? (
              <>
                <Check size={14} />
                Adicionado
              </>
            ) : (
              <>
                <Plus size={14} />
                Pedir
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

import { motion, useReducedMotion } from "motion/react";

const ITEMS = [
  "🍔 GitHub Burger — R$ 32,90",
  "⚡ JavaScript Burger — R$ 29,90",
  "🌶 C++ Burger — PICANTE — R$ 34,90",
  "🟢 Wi-Fi grátis para devs",
  "📦 Delivery 18 min em média",
];

function TickerGroup() {
  return (
    <span className="flex items-center gap-10 pr-16">
      {ITEMS.map((texto) => (
        <span key={texto}>{texto}</span>
      ))}
    </span>
  );
}

export function TickerBar() {
  const reduzirMovimento = useReducedMotion();

  if (reduzirMovimento) {
    return (
      <div className="bg-primary text-white text-xs py-2 overflow-x-auto">
        <div className="flex items-center justify-center gap-10 whitespace-nowrap px-4" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
          {ITEMS.map((texto) => (
            <span key={texto}>{texto}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary text-white text-xs py-2 overflow-hidden relative">
      {/* Duas cópias idênticas lado a lado: animar -50% sempre alinha uma cópia
          exatamente onde a outra estava, sem o salto que um valor fixo em px
          causava quando o conteúdo real não tinha essa largura. */}
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
        className="flex whitespace-nowrap w-max"
        style={{ fontFamily: "'JetBrains Mono',monospace" }}
      >
        <TickerGroup />
        <TickerGroup />
      </motion.div>
    </div>
  );
}

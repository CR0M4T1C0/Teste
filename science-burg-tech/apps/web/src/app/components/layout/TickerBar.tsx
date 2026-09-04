import { motion } from "motion/react";

export function TickerBar() {
  return (
    <div className="bg-primary text-white text-xs py-2 overflow-hidden relative">
      <motion.div
        animate={{ x: [0, -1200] }}
        transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
        className="flex gap-16 whitespace-nowrap"
        style={{ fontFamily: "'JetBrains Mono',monospace" }}
      >
        {Array(4)
          .fill(null)
          .map((_, k) => (
            <span key={k} className="flex items-center gap-10">
              <span>🍔 GitHub Burger — R$ 32,90</span>
              <span>⚡ JavaScript Burger — R$ 29,90</span>
              <span>🌶 C++ Burger — PICANTE — R$ 34,90</span>
              <span>🟢 Wi-Fi grátis para devs</span>
              <span>📦 Delivery 18 min em média</span>
            </span>
          ))}
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { motion } from "motion/react";
import { Cpu, LogOut, Menu, ShoppingCart, User } from "lucide-react";
import { Link, NavLink } from "react-router";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";
import { useScrolled } from "@/app/hooks/useScrolled";

const NAV_LINKS: [string, string][] = [
  ["/cardapio", "Cardápio"],
  ["/sobre", "Sobre Nós"],
  ["/localizacao", "Localização"],
  ["/pedidos", "Meus Pedidos"],
];

export function Header({ totalQty, onOpenCart }: { totalQty: number; onOpenCart: () => void }) {
  const scrolled = useScrolled();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { usuario, logout } = useClienteAuth();

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/96 backdrop-blur-xl border-b border-border shadow-xl shadow-background/20"
          : "bg-background/80 backdrop-blur-md"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <Cpu size={18} className="text-white" />
          </div>
          <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }} className="font-bold text-lg tracking-tight leading-none">
            <span className="text-foreground">Science</span>
            <span className="text-primary">Burg</span>
            <span className="text-accent"> Tech</span>
          </span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(([href, label]) => (
            <NavLink
              key={label}
              to={href}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "text-primary bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to={usuario ? "/pedidos" : "/login"}
            title={usuario ? usuario.nome : "Entrar"}
            className="hidden sm:flex w-10 h-10 rounded-xl border border-border items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex-shrink-0"
          >
            <User size={16} />
          </Link>
          {usuario && (
            <button
              onClick={logout}
              title="Sair da conta"
              className="hidden sm:flex w-10 h-10 rounded-xl border border-border items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors flex-shrink-0"
            >
              <LogOut size={16} />
            </button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onOpenCart}
            className="relative flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-md shadow-primary/30 hover:bg-primary/90 transition-colors"
            style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
          >
            <ShoppingCart size={16} />
            <span className="hidden sm:inline">Carrinho</span>
            {totalQty > 0 && (
              <motion.span
                key={totalQty}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-accent text-background text-[10px] font-black flex items-center justify-center"
              >
                {totalQty}
              </motion.span>
            )}
          </motion.button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="md:hidden bg-card border-t border-border px-5 py-3 space-y-1">
          {NAV_LINKS.map(([href, label]) => (
            <Link
              key={label}
              to={href}
              onClick={() => setMobileOpen(false)}
              className="block py-2 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {label}
            </Link>
          ))}
          {usuario ? (
            <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border">
              <span className="text-sm text-muted-foreground px-1">Olá, {usuario.nome.split(" ")[0]}</span>
              <button
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          ) : (
            <div className="flex gap-2 pt-2 mt-1 border-t border-border">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center py-2.5 px-3 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Entrar
              </Link>
              <Link
                to="/registo"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center py-2.5 px-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                Criar conta
              </Link>
            </div>
          )}
        </motion.div>
      )}
    </header>
  );
}

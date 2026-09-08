import { ChefHat, LogOut } from "lucide-react";
import { Link, Navigate, Outlet } from "react-router";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";

export function AdminLayout() {
  const { administrador, token, carregando, logout } = useAdminAuth();

  if (carregando) return null;
  if (!token || !administrador) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Inter',sans-serif" }}>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm leading-none" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Painel <span className="text-primary">Administrativo</span>
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              {administrador.nome} · {administrador.papel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/cozinha"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <ChefHat size={14} /> Cozinha
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

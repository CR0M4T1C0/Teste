import { useState } from "react";
import { LogIn } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { ApiError } from "@/app/lib/api";

export function AdminLoginPage() {
  const { administrador, login, carregando: carregandoAuth } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!carregandoAuth && administrador) return <Navigate to="/admin" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      navigate("/admin");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6" style={{ fontFamily: "'Inter',sans-serif" }}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            // admin.login()
          </p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Painel <span className="text-primary">Administrativo</span>
          </h1>
        </div>

        <form className="bg-card border border-border rounded-3xl p-6 space-y-4" onSubmit={onSubmit}>
          {erro && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Senha
            </label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-60"
            style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
          >
            <LogIn size={16} /> {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

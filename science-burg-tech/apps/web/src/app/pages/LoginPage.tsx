import { useState } from "react";
import { LogIn } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { FadeUp } from "@/app/components/common/FadeUp";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";
import { ApiError } from "@/app/lib/api";

export function LoginPage() {
  const { login } = useClienteAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      navigate("/pedidos");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="py-20 min-h-[70vh] flex items-center">
      <div className="max-w-md mx-auto px-6 w-full">
        <FadeUp>
          <div className="text-center mb-8">
            <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              // auth.login()
            </p>
            <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Bem-vindo de <span className="text-primary">volta</span>
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
                placeholder="voce@exemplo.com"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
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
                placeholder="••••••••"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30 disabled:opacity-60"
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              <LogIn size={16} /> {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Ainda não tem conta?{" "}
            <Link to="/registo" className="text-primary font-bold hover:underline">
              Criar conta
            </Link>
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

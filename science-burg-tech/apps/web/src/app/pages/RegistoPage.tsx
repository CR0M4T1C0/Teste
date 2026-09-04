import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { FadeUp } from "@/app/components/common/FadeUp";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";
import { ApiError } from "@/app/lib/api";

export function RegistoPage() {
  const { registar } = useClienteAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await registar(nome, email, senha);
      navigate("/pedidos");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível criar a conta. Tente novamente.");
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
              // auth.registo()
            </p>
            <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Crie a sua <span className="text-primary">conta</span>
            </h1>
          </div>

          <form className="bg-card border border-border rounded-3xl p-6 space-y-4" onSubmit={onSubmit}>
            {erro && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                Nome
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="O seu nome"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
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
                minLength={6}
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
              <UserPlus size={16} /> {enviando ? "Criando conta…" : "Criar conta"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Entrar
            </Link>
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

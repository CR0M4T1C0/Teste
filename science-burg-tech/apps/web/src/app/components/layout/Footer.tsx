import { Banknote, Cpu, CreditCard, Facebook, Instagram, Smartphone, Twitter } from "lucide-react";
import { Link } from "react-router";

const PAYMENT_METHODS: [React.ReactNode, string][] = [
  [<CreditCard size={14} />, "Crédito e Débito"],
  [<Smartphone size={14} />, "PIX — Instantâneo"],
  [<Banknote size={14} />, "Dinheiro em espécie"],
];

const SOCIALS = [<Instagram size={15} />, <Facebook size={15} />, <Twitter size={15} />];

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Marca */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Cpu size={16} className="text-white" />
              </div>
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }} className="font-bold text-lg">
                <span className="text-foreground">Science</span>
                <span className="text-primary">Burg</span>
                <span className="text-accent"> Tech</span>
              </span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">
              A hamburgueria onde cada pedido é um deploy de sabor. Open-source para o seu apetite desde 2020.
            </p>
            <div className="flex gap-2">
              {SOCIALS.map((ic, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
                >
                  {ic}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-bold text-foreground mb-4 uppercase tracking-widest" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Menu
            </p>
            <ul className="space-y-2">
              {["Hambúrgueres", "Acompanhamentos", "Bebidas", "Sobremesas"].map((l) => (
                <li key={l}>
                  <Link to="/cardapio" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <p className="text-xs font-bold text-foreground mb-4 uppercase tracking-widest" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Empresa
            </p>
            <ul className="space-y-2">
              {[
                ["Sobre Nós", "/sobre"],
                ["Localização", "/localizacao"],
                ["Carreiras", "#"],
                ["Imprensa", "#"],
              ].map(([l, href]) => (
                <li key={l}>
                  <Link to={href} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Pagamentos */}
          <div>
            <p className="text-xs font-bold text-foreground mb-4 uppercase tracking-widest" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Pagamento
            </p>
            <div className="space-y-2.5 mb-5">
              {PAYMENT_METHODS.map(([ic, l], i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-primary">{ic}</span>
                  {l}
                </div>
              ))}
            </div>
            <div
              className="bg-secondary border border-border rounded-xl p-3 text-[10px] font-mono text-muted-foreground"
              style={{ fontFamily: "'JetBrains Mono',monospace" }}
            >
              <span className="text-accent">$</span> payment --ssl=true
              <br />
              <span className="text-accent">✓</span> Criptografado e seguro
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            © 2025 Science Burg Tech. Todos os direitos reservados.
          </p>
          <p className="text-[11px] text-muted-foreground" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            <span className="text-accent">exit</span>(0); // obrigado pela visita
          </p>
        </div>
      </div>
    </footer>
  );
}

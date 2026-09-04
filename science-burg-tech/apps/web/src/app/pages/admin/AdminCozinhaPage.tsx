import { useCallback, useEffect, useState } from "react";
import { ChefHat, Clock, LogOut, Wifi, WifiOff } from "lucide-react";
import { Navigate } from "react-router";
import { useAdminAuth } from "@/app/hooks/useAdminAuth";
import { useAdminWebSocket } from "@/app/hooks/useAdminWebSocket";
import { adminAlterarStatusPedido, adminListarCozinha } from "@/app/lib/api";
import type { PedidoAdminApi, StatusPedido } from "@/app/types";

const ORIGEM_LABEL: Record<string, (p: PedidoAdminApi) => string> = {
  local: (p) => `Mesa ${p.mesa_numero ?? "?"}`,
  entrega: () => "Entrega",
  retirada: () => "Retirada",
};

function minutosDesde(criadoEm: string): number {
  const data = new Date(criadoEm.replace(" ", "T") + "Z");
  return Math.max(0, Math.floor((Date.now() - data.getTime()) / 60000));
}

function Coluna({
  titulo,
  cor,
  pedidos,
  acao,
}: {
  titulo: string;
  cor: string;
  pedidos: PedidoAdminApi[];
  acao: (pedido: PedidoAdminApi) => { texto: string; onClick: () => void } | null;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center gap-2.5 mb-3 flex-shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${cor}`} />
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          {titulo}
        </h2>
        <span className="text-sm text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
          {pedidos.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {pedidos.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Vazio</p>}
        {pedidos.map((p) => {
          const botao = acao(p);
          const origem = ORIGEM_LABEL[p.tipo]?.(p) ?? p.tipo;
          return (
            <div key={p.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-base font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                  {origem}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  <Clock size={12} /> há {minutosDesde(p.criado_em)} min
                </span>
              </div>
              <ul className="space-y-1 mb-3">
                {p.itens.map((item) => (
                  <li key={item.id} className="text-sm text-foreground">
                    <span className="font-bold">{item.quantidade}x</span> {item.nome_produto}
                  </li>
                ))}
              </ul>
              {p.observacoes && <p className="text-xs text-accent mb-3 italic">"{p.observacoes}"</p>}
              {botao && (
                <button
                  onClick={botao.onClick}
                  className="w-full py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors"
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  {botao.texto}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminCozinhaPage() {
  const { administrador, token, carregando, logout } = useAdminAuth();
  const [pedidos, setPedidos] = useState<PedidoAdminApi[]>([]);
  const [conectado, setConectado] = useState(false);
  const [, forcarAtualizacao] = useState(0);

  const recarregar = useCallback(() => {
    if (!token) return;
    adminListarCozinha(token).then(setPedidos).catch(() => {});
  }, [token]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  useAdminWebSocket(token, () => {
    setConectado(true);
    recarregar();
  });

  // Reconta "há X min" nos cartões sozinho, sem precisar recarregar do
  // servidor — a tela fica ligada o dia inteiro na cozinha.
  useEffect(() => {
    const id = setInterval(() => forcarAtualizacao((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const avancar = async (pedidoId: number, status: StatusPedido) => {
    if (!token) return;
    await adminAlterarStatusPedido(token, pedidoId, status);
    recarregar();
  };

  if (carregando) return null;
  if (!token || !administrador) return <Navigate to="/admin/login" replace />;

  const novos = pedidos.filter((p) => p.status === "pendente" || p.status === "confirmado");
  const emPreparo = pedidos.filter((p) => p.status === "em_preparo");
  const prontos = pedidos.filter((p) => p.status === "pronto");

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden" style={{ fontFamily: "'Inter',sans-serif" }}>
      <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Cozinha
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {conectado ? <Wifi size={14} className="text-accent" /> : <WifiOff size={14} />}
            {conectado ? "Ao vivo" : "Conectando…"}
          </span>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-5 px-6 py-5 overflow-hidden">
        <Coluna
          titulo="Novo"
          cor="bg-primary"
          pedidos={novos}
          acao={(p) => ({ texto: "Iniciar preparo", onClick: () => avancar(p.id, "em_preparo") })}
        />
        <Coluna
          titulo="Em preparo"
          cor="bg-yellow-500"
          pedidos={emPreparo}
          acao={(p) => ({ texto: "Marcar pronto", onClick: () => avancar(p.id, "pronto") })}
        />
        <Coluna titulo="Pronto" cor="bg-accent" pedidos={prontos} acao={() => null} />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, LogIn, PackageSearch, RotateCcw, Star } from "lucide-react";
import { FadeUp } from "@/app/components/common/FadeUp";
import { AvaliarPedidoModal } from "@/app/pages/AvaliarPedidoModal";
import { useCartContext } from "@/app/hooks/useCartContext";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";
import { meusPedidos } from "@/app/lib/api";
import type { PedidoApi, StatusPedido } from "@/app/types";

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const TIPO_LABEL: Record<string, string> = { entrega: "Entrega", retirada: "Retirada", local: "Mesa" };

// A mesa não passa por aqui na prática (quem senta na mesa acompanha pela
// própria tela do QR code), mas cai na mesma sequência da retirada caso
// apareça — "pronto" descreve os dois igualmente bem.
const SEQUENCIA_ENTREGA: StatusPedido[] = ["pendente", "confirmado", "em_preparo", "saiu_para_entrega", "entregue"];
const SEQUENCIA_RETIRADA: StatusPedido[] = ["pendente", "confirmado", "em_preparo", "pronto", "entregue"];

function ProgressoPedido({ tipo, status }: { tipo: string; status: StatusPedido }) {
  if (status === "cancelado") {
    return (
      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-destructive/15 text-destructive flex-shrink-0">Cancelado</span>
    );
  }

  const sequencia = tipo === "entrega" ? SEQUENCIA_ENTREGA : SEQUENCIA_RETIRADA;
  const indiceAtual = Math.max(0, sequencia.indexOf(status));

  return (
    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
      <div className="flex items-center">
        {sequencia.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-2 h-2 rounded-full transition-colors ${i <= indiceAtual ? "bg-primary" : "bg-border"}`} />
            {i < sequencia.length - 1 && (
              <div className={`w-4 h-0.5 transition-colors ${i < indiceAtual ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
      <span className="text-xs font-bold text-foreground whitespace-nowrap">{STATUS_LABEL[status]}</span>
    </div>
  );
}

export function MeusPedidosPage() {
  const { usuario, token, carregando: carregandoAuth } = useClienteAuth();
  const { adicionarVarios } = useCartContext();
  const [pedidos, setPedidos] = useState<PedidoApi[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [repetido, setRepetido] = useState<number | null>(null);
  const [avaliandoPedidoId, setAvaliandoPedidoId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    meusPedidos(token)
      .then(setPedidos)
      .catch(() => setErro("Não foi possível carregar os seus pedidos."));
  }, [token]);

  const pedirDeNovo = (pedido: PedidoApi) => {
    const itensValidos = pedido.itens.filter((i) => i.produto_id != null || i.combo_id != null);
    adicionarVarios(
      itensValidos.map((i) =>
        i.combo_id != null
          ? { id: i.combo_id, tipo: "combo" as const, nome: i.nome_produto, preco: i.preco_unitario, qty: i.quantidade }
          : { id: i.produto_id as number, tipo: "produto" as const, nome: i.nome_produto, preco: i.preco_unitario, qty: i.quantidade },
      ),
    );
    setRepetido(pedido.id);
    window.setTimeout(() => setRepetido((atual) => (atual === pedido.id ? null : atual)), 2500);
  };

  const marcarComoAvaliado = (pedidoId: number) => {
    setPedidos((atual) => atual?.map((p) => (p.id === pedidoId ? { ...p, avaliacao_id: -1 } : p)) ?? atual);
  };

  if (carregandoAuth) return null;

  return (
    <section className="py-20 min-h-[60vh]">
      <div className="max-w-3xl mx-auto px-6">
        <FadeUp className="text-center mb-12">
          <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            // meus_pedidos.log
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
            Meus <span className="text-primary">Pedidos</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
            Acompanhe aqui o histórico e o status dos seus pedidos.
          </p>
        </FadeUp>

        {!usuario ? (
          <FadeUp className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-3xl">
            <LogIn size={44} className="text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">Entre na sua conta para ver o histórico de pedidos.</p>
            <Link
              to="/login"
              className="px-6 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors"
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              Entrar
            </Link>
          </FadeUp>
        ) : erro ? (
          <p className="text-center text-sm text-destructive">{erro}</p>
        ) : pedidos === null ? (
          <p className="text-center text-sm text-muted-foreground py-12">Carregando…</p>
        ) : pedidos.length === 0 ? (
          <FadeUp className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-3xl">
            <PackageSearch size={44} className="text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">Você ainda não fez nenhum pedido.</p>
            <p className="text-xs text-accent mt-1.5" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              // status: aguardando primeiro commit
            </p>
          </FadeUp>
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <FadeUp key={pedido.id} className="bg-card border border-border rounded-3xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                  <p className="text-xs text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    #{pedido.id} · {TIPO_LABEL[pedido.tipo] ?? pedido.tipo} · {new Date(pedido.criado_em).toLocaleString("pt-BR")}
                  </p>
                  <ProgressoPedido tipo={pedido.tipo} status={pedido.status} />
                </div>
                <ul className="space-y-3">
                  {pedido.itens.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-3">
                      <span className="text-foreground font-medium">
                        {item.quantidade}x {item.nome_produto}
                      </span>
                      <span className="text-primary font-bold">R$ {item.subtotal.toFixed(2).replace(".", ",")}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-4 gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => pedirDeNovo(pedido)}
                      disabled={repetido === pedido.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-70"
                    >
                      {repetido === pedido.id ? (
                        <>
                          <Check size={13} className="text-accent" /> Adicionado ao carrinho
                        </>
                      ) : (
                        <>
                          <RotateCcw size={13} /> Pedir de novo
                        </>
                      )}
                    </button>
                    {pedido.status === "entregue" && pedido.avaliacao_id == null && (
                      <button
                        onClick={() => setAvaliandoPedidoId(pedido.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >
                        <Star size={13} /> Avaliar
                      </button>
                    )}
                    {pedido.status === "entregue" && pedido.avaliacao_id != null && (
                      <span className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-accent">
                        <Star size={13} className="fill-accent" /> Avaliado
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      Total
                    </span>
                    <span className="text-primary text-xl font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      R$ {pedido.total.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        )}
      </div>

      {avaliandoPedidoId != null && (
        <AvaliarPedidoModal
          pedidoId={avaliandoPedidoId}
          onClose={() => setAvaliandoPedidoId(null)}
          onEnviada={() => marcarComoAvaliado(avaliandoPedidoId)}
        />
      )}
    </section>
  );
}

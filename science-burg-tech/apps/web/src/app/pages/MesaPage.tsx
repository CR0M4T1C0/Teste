import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { motion } from "motion/react";
import { Check, ChevronUp, Cpu, ReceiptText, UtensilsCrossed } from "lucide-react";
import { CardProduto } from "@/app/components/product/CardProduto";
import { useCardapio } from "@/app/hooks/useCardapio";
import { ApiError, criarPedidoMesa, getMesa, pedirConta } from "@/app/lib/api";
import type { Cat, Item, MesaComandaApi } from "@/app/types";

export function MesaPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { categorias, itensPorCategoria, carregando: carregandoCardapio } = useCardapio();

  const [dados, setDados] = useState<MesaComandaApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat>("hamburguer");
  const [enviandoId, setEnviandoId] = useState<number | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [pedindoConta, setPedindoConta] = useState(false);
  const [contaPedida, setContaPedida] = useState(false);

  useEffect(() => {
    if (!qrToken) return;
    getMesa(qrToken)
      .then(setDados)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Não foi possível carregar esta mesa."));
  }, [qrToken]);

  const adicionar = async (item: Item) => {
    if (!qrToken) return;
    setEnviandoId(item.id);
    try {
      const atualizado = await criarPedidoMesa(qrToken, { itens: [{ produto_id: item.id, quantidade: 1 }] });
      setDados(atualizado);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível adicionar este item.");
    } finally {
      setEnviandoId(null);
    }
  };

  const solicitarConta = async () => {
    if (!qrToken) return;
    setPedindoConta(true);
    try {
      await pedirConta(qrToken);
      setContaPedida(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível chamar a equipe agora.");
    } finally {
      setPedindoConta(false);
    }
  };

  if (erro && !dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-background" style={{ fontFamily: "'Inter',sans-serif" }}>
        <UtensilsCrossed size={40} className="text-muted-foreground/40 mb-4" />
        <p className="text-foreground font-bold mb-1" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Mesa não encontrada
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  const itens = itensPorCategoria[cat] ?? [];
  const comanda = dados.comanda;

  return (
    <div className="min-h-screen bg-background text-foreground pb-28" style={{ fontFamily: "'Inter',sans-serif" }}>
      {/* Top bar minimalista — sem navegação pro resto do site de propósito */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
              <Cpu size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-none" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                Mesa {dados.mesa.numero}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                // comanda aberta
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        {erro && (
          <p className="mb-6 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>
        )}

        <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
          // cardapio.json
        </p>
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          O que vai <span className="text-primary">pedir</span>?
        </h1>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-colors ${
                cat === c.id ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
              }`}
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        {carregandoCardapio ? (
          <p className="text-center text-sm text-muted-foreground py-12">Carregando cardápio…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {itens.map((item) => (
              <div key={item.id} className="relative">
                <CardProduto item={item} onAdd={adicionar} />
                {enviandoId === item.id && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Adicionando…</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra inferior fixa: total da comanda + pedir a conta */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border">
        <button
          onClick={() => setPainelAberto((p) => !p)}
          className="w-full flex items-center justify-between px-5 py-3 max-w-3xl mx-auto"
        >
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              {comanda?.itens.length ?? 0} {comanda?.itens.length === 1 ? "item pedido" : "itens pedidos"}
            </p>
            <p className="font-bold text-lg text-primary" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              R$ {(comanda?.total ?? 0).toFixed(2).replace(".", ",")}
            </p>
          </div>
          <ChevronUp size={18} className={`text-muted-foreground transition-transform ${painelAberto ? "rotate-180" : ""}`} />
        </button>

        {painelAberto && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="max-w-3xl mx-auto px-5 pb-4 overflow-hidden">
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {comanda && comanda.itens.length > 0 ? (
                comanda.itens.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                    <span className="text-foreground font-medium">
                      {item.quantidade}x {item.nome_produto}
                    </span>
                    <span className="text-primary font-bold">R$ {item.subtotal.toFixed(2).replace(".", ",")}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido ainda — escolha algo acima.</p>
              )}
            </div>

            {contaPedida ? (
              <div className="flex items-center justify-center gap-2 py-3 text-accent text-sm font-bold">
                <Check size={16} /> A equipe já foi avisada
              </div>
            ) : (
              <button
                onClick={solicitarConta}
                disabled={!comanda || comanda.itens.length === 0 || pedindoConta}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                <ReceiptText size={16} /> {pedindoConta ? "Chamando…" : "Pedir a conta"}
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

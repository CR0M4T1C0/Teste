import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, MapPin, Minus, Plus, ShoppingCart, Ticket, X } from "lucide-react";
import { Link } from "react-router";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";
import {
  ApiError,
  buscarEnderecoPorCep,
  criarPedido,
  getMeusEnderecos,
  validarCupom,
  type EnderecoApi,
  type ItemPedidoCreateIn,
} from "@/app/lib/api";
import type { Pedido } from "@/app/types";

type Etapa = "carrinho" | "checkout" | "sucesso";

const CAMPO_ENDERECO_VAZIO = { rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "" };

export function CartDrawer({
  open,
  onClose,
  cart,
  totalQty,
  totalPrc,
  onChangeQty,
  onClearCart,
}: {
  open: boolean;
  onClose: () => void;
  cart: Pedido[];
  totalQty: number;
  totalPrc: number;
  onChangeQty: (id: number, tipo: "produto" | "combo", d: number) => void;
  onClearCart: () => void;
}) {
  const { usuario, token } = useClienteAuth();
  const [etapa, setEtapa] = useState<Etapa>("carrinho");
  const [tipo, setTipo] = useState<"retirada" | "entrega">("retirada");
  const [endereco, setEndereco] = useState(CAMPO_ENDERECO_VAZIO);
  const [metodoPagamento, setMetodoPagamento] = useState("pix");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; desconto: number } | null>(null);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  const [enderecosSalvos, setEnderecosSalvos] = useState<EnderecoApi[] | null>(null);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<number | "novo" | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Busca os endereços salvos assim que o cliente escolhe "Entrega" —
  // evita re-digitar tudo se ele já pediu daqui antes.
  useEffect(() => {
    if (tipo !== "entrega" || !token || enderecosSalvos !== null) return;
    getMeusEnderecos(token)
      .then((lista) => {
        setEnderecosSalvos(lista);
        setEnderecoSelecionadoId(lista.length > 0 ? lista[0].id : "novo");
      })
      .catch(() => setEnderecosSalvos([]));
  }, [tipo, token, enderecosSalvos]);

  if (!open) return null;

  const fechar = () => {
    onClose();
    // pequeno atraso pra não "piscar" o formulário voltando pro carrinho
    // enquanto a gaveta ainda está com a animação de saída
    setTimeout(() => {
      setEtapa("carrinho");
      setErro(null);
      setEndereco(CAMPO_ENDERECO_VAZIO);
      setEnderecosSalvos(null);
      setEnderecoSelecionadoId(null);
      setCodigoCupom("");
      setCupomAplicado(null);
      setErroCupom(null);
    }, 250);
  };

  const aplicarCupom = async () => {
    if (!token || !codigoCupom.trim()) return;
    setValidandoCupom(true);
    setErroCupom(null);
    try {
      const resultado = await validarCupom(token, { codigo: codigoCupom.trim(), subtotal: totalPrc });
      if (resultado.valido && resultado.codigo) {
        setCupomAplicado({ codigo: resultado.codigo, desconto: resultado.desconto });
      } else {
        setCupomAplicado(null);
        setErroCupom(resultado.motivo || "Cupom inválido");
      }
    } catch (err) {
      setCupomAplicado(null);
      setErroCupom(err instanceof ApiError ? err.message : "Não foi possível validar o cupom agora.");
    } finally {
      setValidandoCupom(false);
    }
  };

  const removerCupom = () => {
    setCupomAplicado(null);
    setCodigoCupom("");
    setErroCupom(null);
  };

  const buscarCep = async (cep: string) => {
    setEndereco((p) => ({ ...p, cep }));
    if (cep.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    try {
      const encontrado = await buscarEnderecoPorCep(cep);
      if (encontrado) setEndereco((p) => ({ ...p, ...encontrado, cep }));
    } finally {
      setBuscandoCep(false);
    }
  };

  const confirmarPedido = async () => {
    if (!token) return;
    setErro(null);
    setEnviando(true);
    try {
      const itens: ItemPedidoCreateIn[] = cart.map((i) =>
        i.tipo === "combo" ? { combo_id: i.id, quantidade: i.qty } : { produto_id: i.id, quantidade: i.qty },
      );
      await criarPedido(token, {
        tipo,
        itens,
        endereco: tipo === "entrega" && enderecoSelecionadoId === "novo" ? endereco : undefined,
        endereco_id: tipo === "entrega" && typeof enderecoSelecionadoId === "number" ? enderecoSelecionadoId : undefined,
        metodo_pagamento: metodoPagamento,
        codigo_cupom: cupomAplicado?.codigo,
      });
      onClearCart();
      setEtapa("sucesso");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível finalizar o pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const usandoEnderecoNovo = enderecoSelecionadoId === "novo";
  const enderecoValido =
    tipo === "retirada" ||
    (usandoEnderecoNovo
      ? !!(endereco.rua && endereco.numero && endereco.bairro && endereco.cidade && endereco.estado && endereco.cep)
      : typeof enderecoSelecionadoId === "number");

  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 bg-background/60 backdrop-blur-sm" onClick={fechar} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-sm bg-card border-l border-border flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="text-[10px] text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              // meu_pedido.json
            </p>
            <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              {etapa === "checkout" ? "Finalizar Pedido" : etapa === "sucesso" ? "Pedido Enviado" : "Meu Pedido"}
            </h3>
          </div>
          <button onClick={fechar} className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {etapa === "sucesso" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center">
              <Check size={26} className="text-accent" />
            </div>
            <p className="text-foreground font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Pedido enviado com sucesso!
            </p>
            <p className="text-sm text-muted-foreground">Acompanhe o status na página Meus Pedidos.</p>
            <Link
              to="/pedidos"
              onClick={fechar}
              className="mt-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              Ver Meus Pedidos
            </Link>
          </div>
        ) : etapa === "checkout" ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex gap-2">
              {(["retirada", "entrega"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    tipo === t ? "bg-primary text-white border-primary" : "bg-secondary border-border text-muted-foreground"
                  }`}
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  {t === "retirada" ? "Retirar no balcão" : "Entrega"}
                </button>
              ))}
            </div>

            {tipo === "entrega" && (
              <div className="space-y-2.5">
                {enderecosSalvos === null ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Carregando endereços…</p>
                ) : (
                  <>
                    {enderecosSalvos.length > 0 && (
                      <div className="space-y-2">
                        {enderecosSalvos.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => setEnderecoSelecionadoId(e.id)}
                            className={`w-full text-left px-3.5 py-3 rounded-xl border transition-colors flex items-start gap-2.5 ${
                              enderecoSelecionadoId === e.id ? "bg-primary/10 border-primary" : "bg-secondary border-border"
                            }`}
                          >
                            <MapPin size={15} className={`mt-0.5 flex-shrink-0 ${enderecoSelecionadoId === e.id ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="text-xs text-foreground leading-relaxed">
                              {e.rua}, {e.numero}
                              {e.complemento ? ` — ${e.complemento}` : ""}
                              <br />
                              <span className="text-muted-foreground">
                                {e.bairro}, {e.cidade}/{e.estado} · {e.cep}
                              </span>
                            </span>
                          </button>
                        ))}
                        <button
                          onClick={() => setEnderecoSelecionadoId("novo")}
                          className={`w-full text-center py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                            usandoEnderecoNovo ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground"
                          }`}
                        >
                          + Usar outro endereço
                        </button>
                      </div>
                    )}

                    {usandoEnderecoNovo && (
                      <div className="space-y-2.5">
                        <div className="relative">
                          <input
                            value={endereco.cep}
                            onChange={(e) => buscarCep(e.target.value)}
                            placeholder="CEP"
                            className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                          />
                          {buscandoCep && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">buscando…</span>
                          )}
                        </div>
                        {(
                          [
                            ["rua", "Rua"],
                            ["numero", "Número"],
                            ["complemento", "Complemento (opcional)"],
                            ["bairro", "Bairro"],
                            ["cidade", "Cidade"],
                            ["estado", "Estado (UF)"],
                          ] as const
                        ).map(([campo, label]) => (
                          <input
                            key={campo}
                            value={endereco[campo]}
                            onChange={(e) => setEndereco((p) => ({ ...p, [campo]: e.target.value }))}
                            placeholder={label}
                            className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                          />
                        ))}
                        <p className="text-[10px] text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                          // preenche rua/bairro/cidade sozinho a partir do CEP
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-foreground mb-1.5" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                Pagamento
              </p>
              <select
                value={metodoPagamento}
                onChange={(e) => setMetodoPagamento(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
              >
                <option value="pix">Pix</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>

            <div>
              <p className="text-xs font-bold text-foreground mb-1.5" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                Cupom de desconto
              </p>
              {cupomAplicado ? (
                <div className="flex items-center justify-between gap-2 bg-accent/10 border border-accent/30 rounded-xl px-3.5 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-accent" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    <Ticket size={13} /> {cupomAplicado.codigo} aplicado — -R$ {cupomAplicado.desconto.toFixed(2).replace(".", ",")}
                  </span>
                  <button type="button" onClick={removerCupom} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={codigoCupom}
                    onChange={(e) => setCodigoCupom(e.target.value)}
                    placeholder="Ex: BEMVINDO10"
                    className="flex-1 min-w-0 bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors uppercase"
                  />
                  <button
                    type="button"
                    onClick={aplicarCupom}
                    disabled={!codigoCupom.trim() || validandoCupom}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {validandoCupom ? "..." : "Aplicar"}
                  </button>
                </div>
              )}
              {erroCupom && <p className="mt-1.5 text-xs text-destructive">{erroCupom}</p>}
            </div>

            {erro && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShoppingCart size={44} className="text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
                <p className="text-xs text-accent mt-1.5 font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                  // adicione itens para começar
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <motion.div
                  key={`${item.tipo}-${item.id}`}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3.5 bg-secondary border border-border rounded-2xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      {item.nome}
                    </p>
                    <p className="text-xs text-primary font-bold">R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onChangeQty(item.id, item.tipo, -1)}
                      className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold text-foreground w-5 text-center" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                      {item.qty}
                    </span>
                    <button
                      onClick={() => onChangeQty(item.id, item.tipo, +1)}
                      className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary/90 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Resumo + ação */}
        {cart.length > 0 && etapa !== "sucesso" && (
          <div className="p-5 border-t border-border space-y-3">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Subtotal ({totalQty} {totalQty === 1 ? "item" : "itens"})
              </span>
              <span className="text-foreground font-bold">R$ {totalPrc.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Entrega</span>
              <span className="text-accent font-bold">Grátis</span>
            </div>
            {etapa === "checkout" && cupomAplicado && (
              <div className="flex justify-between text-sm text-accent">
                <span>Cupom {cupomAplicado.codigo}</span>
                <span className="font-bold">-R$ {cupomAplicado.desconto.toFixed(2).replace(".", ",")}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-border pt-3">
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>Total</span>
              <span className="text-2xl text-primary" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                R$ {Math.max(totalPrc - (etapa === "checkout" && cupomAplicado ? cupomAplicado.desconto : 0), 0).toFixed(2).replace(".", ",")}
              </span>
            </div>

            {!usuario ? (
              <Link
                to="/login"
                onClick={fechar}
                className="block w-full text-center py-4 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                Entrar para finalizar →
              </Link>
            ) : etapa === "checkout" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEtapa("carrinho")}
                  className="px-4 py-4 rounded-2xl text-sm font-bold border border-border text-foreground hover:bg-secondary transition-colors"
                >
                  Voltar
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={!enderecoValido || enviando}
                  onClick={confirmarPedido}
                  className="flex-1 py-4 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-60"
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  {enviando ? "Enviando…" : "Confirmar Pedido"}
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setEtapa("checkout")}
                className="w-full py-4 bg-primary text-white font-bold text-sm rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/30"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                Finalizar Pedido →
              </motion.button>
            )}
            <p className="text-center text-[10px] text-muted-foreground font-mono" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              // pagamento seguro e criptografado
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

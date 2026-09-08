import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { gptConversar, gptStatus } from "@/app/lib/api";

type Mensagem = { autor: "cliente" | "gpt"; texto: string };

// Só as últimas trocas são enviadas ao servidor: histórico longo encarece a
// chamada ao provedor sem melhorar a resposta num atendimento curto.
const MAX_HISTORICO = 12;

const SAUDACAO: Mensagem = {
  autor: "gpt",
  texto:
    "Fala! Sou o G.P.T. — Grill Potato Toast. Posso te ajudar a escolher no cardápio. O que você tá com vontade de comer?",
};

const SUGESTOES = [
  "O que vocês têm de mais pedido?",
  "Tem opção vegetariana?",
  "Qual o combo com melhor custo?",
];

export function GptChat() {
  const [disponivel, setDisponivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([SAUDACAO]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fimDaLista = useRef<HTMLDivElement>(null);

  // O botão só aparece se a API confirmar que a IA está configurada. Sem
  // isso, o site mostraria um atendente que nunca responde.
  useEffect(() => {
    gptStatus()
      .then((r) => setDisponivel(r.disponivel))
      .catch(() => setDisponivel(false));
  }, []);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  if (!disponivel) return null;

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || carregando) return;

    const novoHistorico: Mensagem[] = [...mensagens, { autor: "cliente", texto: limpa }];
    setMensagens(novoHistorico);
    setTexto("");
    setErro(null);
    setCarregando(true);

    try {
      const r = await gptConversar(novoHistorico.slice(-MAX_HISTORICO));
      setMensagens((atual) => [...atual, { autor: "gpt", texto: r.resposta }]);
    } catch (e) {
      // Inclui o 429 do limite de uso, que traz uma mensagem já pronta.
      setErro(e instanceof Error ? e.message : "Não consegui responder agora.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar o G.P.T." : "Conversar com o G.P.T."}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:scale-105 active:scale-95"
      >
        {aberto ? <X size={22} /> : <Bot size={24} />}
      </button>

      {aberto && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[30rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14142a] shadow-2xl">
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
              <Bot size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">G.P.T.</p>
              <p className="text-xs text-white/50">Grill Potato Toast</p>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {mensagens.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.autor === "cliente"
                    ? "ml-auto bg-primary text-white"
                    : "bg-white/5 text-white/90"
                }`}
              >
                {m.texto}
              </div>
            ))}

            {mensagens.length === 1 && (
              <div className="space-y-2 pt-1">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="block w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-white/70 transition hover:border-primary hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {carregando && (
              <div className="w-fit rounded-xl bg-white/5 px-3 py-2 text-sm text-white/50">
                preparando a resposta…
              </div>
            )}
            {erro && <p className="text-xs text-red-400">{erro}</p>}

            <div ref={fimDaLista} />
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar(texto)}
                maxLength={600}
                placeholder="Pergunte sobre o cardápio…"
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => enviar(texto)}
                disabled={carregando || !texto.trim()}
                aria-label="Enviar"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="pt-2 text-center text-[10px] text-white/30">
              Sugestões geradas por IA — confira o cardápio antes de pedir.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

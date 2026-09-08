import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { AlertTriangle, DoorOpen, Mic, MicOff, PhoneOff, Send, ShieldOff, Users } from "lucide-react";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";
import { useMesaVirtualSocket } from "@/app/hooks/useMesaVirtualSocket";
import { useWebRTCVoz } from "@/app/hooks/useWebRTCVoz";
import {
  ApiError,
  bloquearUsuario,
  denunciarUsuarioMesaVirtual,
  getMensagensMesaVirtual,
  getMesaVirtual,
  sairMesaVirtual,
  sentarMesaVirtual,
} from "@/app/lib/api";
import { corAvatar, iniciais, temaInfo } from "@/app/data/temasMesaVirtual";
import type { MensagemMesaVirtualApi, MesaVirtualDetalheApi } from "@/app/types";

export function MesaVirtualPage() {
  const { mesaId } = useParams<{ mesaId: string }>();
  const mesaVirtualId = Number(mesaId);
  const { usuario, token } = useClienteAuth();
  const navigate = useNavigate();

  const [mesa, setMesa] = useState<MesaVirtualDetalheApi | null>(null);
  const [mensagens, setMensagens] = useState<MensagemMesaVirtualApi[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState<number | null>(null);
  const [denunciarAlvo, setDenunciarAlvo] = useState<{ usuarioId: number; nome: string } | null>(null);
  const [motivoDenuncia, setMotivoDenuncia] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    if (!token || !mesaVirtualId) return;
    try {
      const [detalhe, historico] = await Promise.all([
        getMesaVirtual(mesaVirtualId, token),
        getMensagensMesaVirtual(token, mesaVirtualId).catch(() => []),
      ]);
      setMesa(detalhe);
      setMensagens(historico);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível carregar esta mesa.");
    } finally {
      setCarregando(false);
    }
  }, [token, mesaVirtualId]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { state: { depois: `/mesa-virtual/${mesaVirtualId}` } });
      return;
    }
    carregar();
  }, [token, carregar, mesaVirtualId, navigate]);

  const meuLugar = mesa?.meu_lugar ?? null;
  const participantesIds = (mesa?.lugares ?? []).flatMap((l) => (l.participante ? [l.participante.usuario_id] : []));

  const { enviarMensagem, enviarSinal } = useMesaVirtualSocket(meuLugar ? mesaVirtualId : null, token, {
    onMensagem: (m) => setMensagens((atual) => [...atual, m]),
    onMensagemRemovida: (id) => setMensagens((atual) => atual.filter((m) => m.id !== id)),
    onParticipanteSentou: (p) =>
      setMesa((atual) =>
        atual
          ? { ...atual, lugares: atual.lugares.map((l) => (l.numero === p.lugar_numero ? { ...l, participante: p } : l)) }
          : atual,
      ),
    onParticipanteSaiu: (dados) =>
      setMesa((atual) =>
        atual
          ? { ...atual, lugares: atual.lugares.map((l) => (l.numero === dados.lugar_numero ? { ...l, participante: null } : l)) }
          : atual,
      ),
    onSinal: (s) => voz.receberSinal(s),
    onRemovido: (motivo) => {
      alert(`Você foi removido da mesa: ${motivo}`);
      navigate("/network-da-fome");
    },
    onErro: (mensagem) => setErro(mensagem),
  });

  const voz = useWebRTCVoz({ meuUsuarioId: usuario?.id ?? null, participantesIds, enviarSinal });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens.length]);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;
    enviarMensagem(limpo);
    setTexto("");
  };

  const sentarNaMesa = async () => {
    if (!token) return;
    try {
      const detalhe = await sentarMesaVirtual(token, mesaVirtualId);
      setMesa(detalhe);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível sentar nesta mesa.");
    }
  };

  const sair = async () => {
    if (!token) return;
    try {
      await sairMesaVirtual(token, mesaVirtualId);
    } catch {
      // se já saiu (ex.: outra aba), não faz diferença — segue voltando ao salão
    }
    voz.sairDaVoz();
    navigate("/network-da-fome");
  };

  const confirmarDenuncia = async () => {
    if (!token || !denunciarAlvo) return;
    try {
      await denunciarUsuarioMesaVirtual(token, mesaVirtualId, {
        denunciado_usuario_id: denunciarAlvo.usuarioId,
        motivo: motivoDenuncia.trim() || "Comportamento inadequado",
      });
      setDenunciarAlvo(null);
      setMotivoDenuncia("");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar a denúncia.");
    }
  };

  const bloquear = async (usuarioId: number) => {
    if (!token) return;
    try {
      await bloquearUsuario(token, usuarioId);
      setMensagens((atual) => atual.filter((m) => m.usuario_id !== usuarioId));
      setMenuAberto(null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível bloquear este usuário.");
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Entrando na mesa…</p>
      </div>
    );
  }

  if (!mesa) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-background">
        <p className="text-foreground font-bold mb-1" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Mesa não encontrada
        </p>
        <p className="text-sm text-muted-foreground max-w-xs mb-4">{erro}</p>
        <button onClick={() => navigate("/network-da-fome")} className="text-primary text-sm font-bold hover:underline">
          Voltar ao salão
        </button>
      </div>
    );
  }

  const info = temaInfo(mesa.tema);

  if (!meuLugar) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-background">
        <p className="text-2xl mb-2">{info.emoji}</p>
        <p className="text-foreground font-bold mb-1" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          Você ainda não está sentado na {mesa.nome}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">Sente-se para participar da conversa desta mesa.</p>
        {erro && <p className="text-xs text-destructive mb-4">{erro}</p>}
        <button
          onClick={sentarNaMesa}
          className="px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
          style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
        >
          Sentar nesta mesa
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={{ fontFamily: "'Inter',sans-serif" }}>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm leading-none" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              🍔 {mesa.nome} — {info.emoji} {info.label}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              {mesa.lugares.filter((l) => l.participante).length}/{mesa.capacidade} sentados
            </p>
          </div>
          <button
            onClick={sair}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
          >
            <DoorOpen size={14} /> Sair da mesa
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto w-full px-5 py-6 flex-1 flex flex-col gap-6">
        {erro && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

        {/* Lugares da mesa */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex flex-wrap gap-4 justify-center">
            {mesa.lugares.map((lugar) => (
              <div key={lugar.numero} className="flex flex-col items-center gap-1.5 w-20">
                {lugar.participante ? (
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: corAvatar(lugar.participante.usuario_id) }}
                    >
                      {iniciais(lugar.participante.nome)}
                    </div>
                    {voz.vozAtiva && voz.participantesConectados.has(lugar.participante.usuario_id) && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent border-2 border-card flex items-center justify-center">
                        <Mic size={9} className="text-background" />
                      </span>
                    )}
                    {lugar.participante.usuario_id !== usuario?.id && (
                      <button
                        onClick={() => setMenuAberto(menuAberto === lugar.participante!.usuario_id ? null : lugar.participante!.usuario_id)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary border border-border text-[10px] flex items-center justify-center"
                      >
                        ⋯
                      </button>
                    )}
                    {menuAberto === lugar.participante.usuario_id && (
                      <div className="absolute z-40 top-full mt-1 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl overflow-hidden w-32">
                        <button
                          onClick={() => {
                            setDenunciarAlvo({ usuarioId: lugar.participante!.usuario_id, nome: lugar.participante!.nome });
                            setMenuAberto(null);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-secondary flex items-center gap-1.5"
                        >
                          <AlertTriangle size={12} /> Denunciar
                        </button>
                        <button
                          onClick={() => bloquear(lugar.participante!.usuario_id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-secondary flex items-center gap-1.5"
                        >
                          <ShieldOff size={12} /> Bloquear
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-border" />
                )}
                <p className="text-[11px] text-center text-muted-foreground truncate w-full">
                  {lugar.participante ? (lugar.participante.usuario_id === usuario?.id ? "Você" : lugar.participante.nome) : "Livre"}
                </p>
                {lugar.participante?.comendo && (
                  <p className="text-[9px] text-center text-muted-foreground/70 truncate w-full" title={lugar.participante.comendo}>
                    🍔 {lugar.participante.comendo}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Controles de voz */}
          <div className="flex items-center justify-center gap-3 mt-6 pt-5 border-t border-border">
            {voz.falandoComErro && <p className="text-xs text-destructive mr-2">{voz.falandoComErro}</p>}
            {!voz.vozAtiva ? (
              <button
                onClick={voz.entrarNaVoz}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent text-background font-bold text-sm hover:opacity-90 transition-opacity"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
              >
                <Mic size={15} /> Entrar na conversa
              </button>
            ) : (
              <>
                <button
                  onClick={voz.alternarMicrofone}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-colors ${
                    voz.microfoneAberto ? "bg-secondary border border-border text-foreground" : "bg-destructive/15 text-destructive border border-destructive/30"
                  }`}
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  {voz.microfoneAberto ? <Mic size={15} /> : <MicOff size={15} />} {voz.microfoneAberto ? "Microfone ligado" : "Mudo"}
                </button>
                <button
                  onClick={voz.sairDaVoz}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-destructive/15 text-destructive border border-destructive/30 font-bold text-sm hover:bg-destructive/25 transition-colors"
                  style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                >
                  <PhoneOff size={15} /> Sair da voz
                </button>
              </>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="bg-card border border-border rounded-2xl flex flex-col flex-1 min-h-[320px]">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Users size={14} className="text-muted-foreground" />
            <p className="text-xs font-bold text-muted-foreground" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Chat da mesa
            </p>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-96">
            {mensagens.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">Ninguém falou nada ainda — que tal puxar assunto?</p>
            )}
            {mensagens.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                  style={{ backgroundColor: corAvatar(m.usuario_id) }}
                >
                  {iniciais(m.nome)}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                    {m.usuario_id === usuario?.id ? "Você" : m.nome}
                  </p>
                  <p className="text-sm text-foreground/90 break-words">{m.texto}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={enviar} className="flex items-center gap-2 p-3 border-t border-border">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={500}
              placeholder="Escreva uma mensagem…"
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
            <button
              type="submit"
              disabled={!texto.trim()}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Modal simples de denúncia */}
      {denunciarAlvo && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-5" onClick={() => setDenunciarAlvo(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold mb-1" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
              Denunciar {denunciarAlvo.nome}
            </p>
            <p className="text-xs text-muted-foreground mb-3">Conte rapidamente o que aconteceu — a equipe vai avaliar.</p>
            <textarea
              value={motivoDenuncia}
              onChange={(e) => setMotivoDenuncia(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Descreva o motivo…"
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setDenunciarAlvo(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground"
              >
                Cancelar
              </button>
              <button onClick={confirmarDenuncia} className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-bold">
                Enviar denúncia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

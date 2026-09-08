import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Lock, Users } from "lucide-react";
import { useClienteAuth } from "@/app/hooks/useClienteAuth";
import { useSalaoVirtualSocket } from "@/app/hooks/useSalaoVirtualSocket";
import { ApiError, getMesasVirtuais, sentarMesaVirtual } from "@/app/lib/api";
import { corAvatar, iniciais, TEMAS_MESA_VIRTUAL, temaInfo } from "@/app/data/temasMesaVirtual";
import type { MesaVirtualApi, TemaMesaVirtual } from "@/app/types";

export function NetworkDaFomePage() {
  const { usuario, token } = useClienteAuth();
  const navigate = useNavigate();

  const [mesas, setMesas] = useState<MesaVirtualApi[]>([]);
  const [temaFiltro, setTemaFiltro] = useState<TemaMesaVirtual | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sentandoId, setSentandoId] = useState<number | null>(null);

  const recarregar = useCallback(() => {
    getMesasVirtuais(temaFiltro ?? undefined)
      .then((dados) => setMesas(dados))
      .catch(() => setErro("Não foi possível carregar o salão agora."))
      .finally(() => setCarregando(false));
  }, [temaFiltro]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // Mantém a lista atualizada sozinha enquanto o usuário está navegando o
  // salão — sem precisar entrar numa mesa para ver a ocupação mudar.
  useSalaoVirtualSocket(recarregar);

  const sentar = async (mesa: MesaVirtualApi) => {
    if (!token) {
      navigate("/login", { state: { depois: "/network-da-fome" } });
      return;
    }
    setErro(null);
    setSentandoId(mesa.id);
    try {
      await sentarMesaVirtual(token, mesa.id);
      navigate(`/mesa-virtual/${mesa.id}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível sentar nesta mesa agora.");
      recarregar();
    } finally {
      setSentandoId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Inter',sans-serif" }}>
      <div className="max-w-6xl mx-auto px-5 py-10">
        <p className="text-xs text-accent mb-2" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
          // salao_social.tsx
        </p>
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
          🍔 Comer com a <span className="text-primary">Galera</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mb-8">
          Sente numa mesa virtual e converse por texto ou voz com outras pessoas enquanto come — não precisa se
          conhecer antes. Todas as mesas são públicas.
        </p>

        {!usuario && (
          <div className="mb-6 flex items-center gap-2 text-sm bg-secondary border border-border rounded-2xl px-4 py-3 text-muted-foreground">
            <Lock size={14} /> Você pode olhar o salão à vontade — para sentar numa mesa, faça login primeiro.
          </div>
        )}

        {erro && <p className="mb-6 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{erro}</p>}

        {/* Filtro de temas */}
        <div className="flex gap-2 overflow-x-auto mb-8 pb-1">
          <button
            onClick={() => setTemaFiltro(null)}
            className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-colors ${
              temaFiltro === null ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
            }`}
            style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
          >
            Todas as mesas
          </button>
          {TEMAS_MESA_VIRTUAL.map((t) => (
            <button
              key={t.valor}
              onClick={() => setTemaFiltro(t.valor)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-colors ${
                temaFiltro === t.valor ? "bg-primary text-white" : "bg-secondary border border-border text-muted-foreground"
              }`}
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {carregando ? (
          <p className="text-center text-sm text-muted-foreground py-16">Carregando o salão…</p>
        ) : mesas.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">Nenhuma mesa com esse tema agora.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {mesas.map((mesa) => {
              const info = temaInfo(mesa.tema);
              const vazia = mesa.lugares_ocupados === 0;
              return (
                <motion.div
                  key={mesa.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-lg" style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                      {mesa.nome}
                    </p>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {info.emoji} {info.label}
                    </span>
                  </div>

                  {/* Lugares ocupados/livres representados como cadeirinhas */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Array.from({ length: mesa.capacidade }).map((_, i) => {
                      const participante = mesa.participantes[i];
                      return participante ? (
                        <div
                          key={i}
                          title={participante.nome}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                          style={{ backgroundColor: corAvatar(participante.usuario_id) }}
                        >
                          {iniciais(participante.nome)}
                        </div>
                      ) : (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-dashed border-border shrink-0" />
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        mesa.cheia ? "text-destructive" : vazia ? "text-accent" : "text-accent"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${mesa.cheia ? "bg-destructive" : "bg-accent"}`} />
                      {mesa.cheia
                        ? "Lotada"
                        : vazia
                        ? "Livre"
                        : `${mesa.lugares_disponiveis} ${mesa.lugares_disponiveis === 1 ? "lugar disponível" : "lugares disponíveis"}`}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users size={12} /> {mesa.lugares_ocupados}/{mesa.capacidade}
                    </span>
                  </div>

                  <button
                    onClick={() => sentar(mesa)}
                    disabled={mesa.cheia || sentandoId === mesa.id}
                    className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ fontFamily: "'Bricolage Grotesque',sans-serif" }}
                  >
                    {sentandoId === mesa.id ? "Sentando…" : mesa.cheia ? "Mesa lotada" : "Sentar"}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

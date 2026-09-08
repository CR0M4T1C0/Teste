import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voz por WebRTC entre os participantes de uma mesa virtual — malha
 * (mesh): cada pessoa mantém uma RTCPeerConnection de áudio com cada uma
 * das outras. Funciona bem até 6 pessoas (capacidade máxima de uma mesa),
 * que é exatamente o tamanho para o qual isto foi desenhado; não escalaria
 * para salas grandes (aí precisaria de um SFU de verdade).
 *
 * A sinalização (oferta/resposta/candidatos ICE) viaja pelo próprio
 * WebSocket da mesa (ver useMesaVirtualSocket + app/websocket.py no
 * back-end) — a API só repassa os pacotes de um participante para o outro,
 * sem entender nem guardar o conteúdo.
 *
 * IMPORTANTE (limite conhecido): só o STUN público do Google está
 * configurado abaixo. Isso basta para a maioria das redes domésticas, mas
 * duas pessoas atrás de NAT simétrico/CGNAT restritivo podem não conseguir
 * conectar áudio direto sem um servidor TURN — para produção, considere
 * configurar um TURN (ex.: coturn próprio, ou um serviço gerenciado) e
 * adicionar aqui.
 */

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type SinalRecebido = { de: number; dados: any };

export function useWebRTCVoz(params: {
  meuUsuarioId: number | null;
  participantesIds: number[];
  enviarSinal: (para: number, dados: unknown) => void;
}) {
  const { meuUsuarioId, participantesIds, enviarSinal } = params;

  const [vozAtiva, setVozAtiva] = useState(false);
  const [microfoneAberto, setMicrofoneAberto] = useState(true);
  const [falandoComErro, setFalandoComErro] = useState<string | null>(null);
  const [participantesConectados, setParticipantesConectados] = useState<Set<number>>(new Set());

  const streamLocalRef = useRef<MediaStream | null>(null);
  const conexoesRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const audiosRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const enviarSinalRef = useRef(enviarSinal);
  enviarSinalRef.current = enviarSinal;

  const pararTudo = useCallback(() => {
    for (const pc of conexoesRef.current.values()) pc.close();
    conexoesRef.current.clear();
    for (const audio of audiosRef.current.values()) {
      audio.srcObject = null;
      audio.remove();
    }
    audiosRef.current.clear();
    streamLocalRef.current?.getTracks().forEach((t) => t.stop());
    streamLocalRef.current = null;
    setParticipantesConectados(new Set());
    setVozAtiva(false);
  }, []);

  const criarConexao = useCallback(
    (paraUsuarioId: number, ehQuemInicia: boolean) => {
      if (conexoesRef.current.has(paraUsuarioId)) return conexoesRef.current.get(paraUsuarioId)!;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      conexoesRef.current.set(paraUsuarioId, pc);

      streamLocalRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, streamLocalRef.current!);
      });

      pc.onicecandidate = (evento) => {
        if (evento.candidate) {
          enviarSinalRef.current(paraUsuarioId, { tipo: "ice", candidato: evento.candidate.toJSON() });
        }
      };

      pc.ontrack = (evento) => {
        let audio = audiosRef.current.get(paraUsuarioId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audiosRef.current.set(paraUsuarioId, audio);
        }
        audio.srcObject = evento.streams[0];
        setParticipantesConectados((atual) => new Set(atual).add(paraUsuarioId));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
          setParticipantesConectados((atual) => {
            const novo = new Set(atual);
            novo.delete(paraUsuarioId);
            return novo;
          });
        }
      };

      if (ehQuemInicia) {
        pc.onnegotiationneeded = async () => {
          try {
            const oferta = await pc.createOffer();
            await pc.setLocalDescription(oferta);
            enviarSinalRef.current(paraUsuarioId, { tipo: "oferta", sdp: pc.localDescription });
          } catch {
            // negociação falhou — a pessoa pode tentar de novo saindo/entrando na voz
          }
        };
      }

      return pc;
    },
    [],
  );

  // Conecta com cada participante novo da mesa; quem tem o menor id entre
  // os dois é quem inicia a oferta — evita as duas pontas mandarem oferta
  // ao mesmo tempo (glare) sem precisar de um servidor "árbitro".
  useEffect(() => {
    if (!vozAtiva || meuUsuarioId == null) return;

    for (const outroId of participantesIds) {
      if (outroId === meuUsuarioId || conexoesRef.current.has(outroId)) continue;
      criarConexao(outroId, meuUsuarioId < outroId);
    }

    for (const [id, pc] of conexoesRef.current) {
      if (!participantesIds.includes(id)) {
        pc.close();
        conexoesRef.current.delete(id);
        audiosRef.current.get(id)?.remove();
        audiosRef.current.delete(id);
        setParticipantesConectados((atual) => {
          const novo = new Set(atual);
          novo.delete(id);
          return novo;
        });
      }
    }
  }, [vozAtiva, meuUsuarioId, participantesIds, criarConexao]);

  const receberSinal = useCallback(
    async ({ de, dados }: SinalRecebido) => {
      if (!vozAtiva || meuUsuarioId == null) return;
      const pc = conexoesRef.current.get(de) ?? criarConexao(de, false);

      if (dados?.tipo === "oferta") {
        await pc.setRemoteDescription(new RTCSessionDescription(dados.sdp));
        const resposta = await pc.createAnswer();
        await pc.setLocalDescription(resposta);
        enviarSinalRef.current(de, { tipo: "resposta", sdp: pc.localDescription });
      } else if (dados?.tipo === "resposta") {
        await pc.setRemoteDescription(new RTCSessionDescription(dados.sdp));
      } else if (dados?.tipo === "ice" && dados.candidato) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(dados.candidato));
        } catch {
          // candidato chegou antes da descrição remota — inofensivo de ignorar
        }
      }
    },
    [vozAtiva, meuUsuarioId, criarConexao],
  );

  const entrarNaVoz = useCallback(async () => {
    setFalandoComErro(null);
    try {
      streamLocalRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setVozAtiva(true);
      setMicrofoneAberto(true);
    } catch {
      setFalandoComErro("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  }, []);

  const sairDaVoz = useCallback(() => {
    pararTudo();
  }, [pararTudo]);

  const alternarMicrofone = useCallback(() => {
    const stream = streamLocalRef.current;
    if (!stream) return;
    const novoEstado = !microfoneAberto;
    stream.getAudioTracks().forEach((t) => (t.enabled = novoEstado));
    setMicrofoneAberto(novoEstado);
  }, [microfoneAberto]);

  useEffect(() => () => pararTudo(), [pararTudo]);

  return {
    vozAtiva,
    microfoneAberto,
    falandoComErro,
    participantesConectados,
    entrarNaVoz,
    sairDaVoz,
    alternarMicrofone,
    receberSinal,
  };
}

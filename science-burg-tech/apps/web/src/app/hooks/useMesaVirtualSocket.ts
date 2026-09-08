import { useEffect, useRef, useState } from "react";
import { wsMesaVirtualUrl } from "@/app/lib/api";
import type { MensagemMesaVirtualApi, ParticipanteMesaVirtualApi } from "@/app/types";

type SinalPayload = { de: number; nome: string; dados: unknown };

type EventosMesaVirtual = {
  onMensagem?: (m: MensagemMesaVirtualApi) => void;
  onMensagemRemovida?: (mensagemId: number) => void;
  onParticipanteSentou?: (p: ParticipanteMesaVirtualApi) => void;
  onParticipanteSaiu?: (dados: { usuario_id: number; lugar_numero: number }) => void;
  onSinal?: (s: SinalPayload) => void;
  onRemovido?: (motivo: string) => void;
  onErro?: (mensagem: string) => void;
};

/** Conecta no WebSocket de uma mesa virtual (chat + presença + sinalização
 * de voz). Só funciona se o usuário já estiver sentado na mesa — a API
 * recusa a conexão (código 4403) caso contrário. Reconecta sozinho. */
export function useMesaVirtualSocket(mesaVirtualId: number | null, token: string | null, eventos: EventosMesaVirtual) {
  const eventosRef = useRef(eventos);
  eventosRef.current = eventos;
  const socketRef = useRef<WebSocket | null>(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!mesaVirtualId || !token) return;

    let socket: WebSocket | null = null;
    let timeoutReconexao: ReturnType<typeof setTimeout> | null = null;
    let cancelado = false;

    const conectar = () => {
      socket = new WebSocket(wsMesaVirtualUrl(mesaVirtualId, token));
      socketRef.current = socket;

      socket.onopen = () => setConectado(true);
      socket.onclose = () => {
        setConectado(false);
        if (!cancelado) timeoutReconexao = setTimeout(conectar, 3000);
      };
      socket.onmessage = (evento) => {
        let payload: { evento: string; dados: unknown };
        try {
          payload = JSON.parse(evento.data);
        } catch {
          return;
        }
        const e = eventosRef.current;
        switch (payload.evento) {
          case "mensagem":
            e.onMensagem?.(payload.dados as MensagemMesaVirtualApi);
            break;
          case "mensagem_removida":
            e.onMensagemRemovida?.((payload.dados as { mensagem_id: number }).mensagem_id);
            break;
          case "participante_sentou":
            e.onParticipanteSentou?.(payload.dados as ParticipanteMesaVirtualApi);
            break;
          case "participante_saiu":
            e.onParticipanteSaiu?.(payload.dados as { usuario_id: number; lugar_numero: number });
            break;
          case "sinal":
            e.onSinal?.(payload.dados as SinalPayload);
            break;
          case "removido":
            e.onRemovido?.((payload.dados as { motivo: string }).motivo);
            break;
          case "erro":
            e.onErro?.((payload.dados as { mensagem: string }).mensagem);
            break;
        }
      };
    };

    conectar();

    return () => {
      cancelado = true;
      if (timeoutReconexao) clearTimeout(timeoutReconexao);
      socket?.close();
      socketRef.current = null;
    };
  }, [mesaVirtualId, token]);

  const enviarMensagem = (texto: string) => {
    socketRef.current?.send(JSON.stringify({ tipo: "chat", texto }));
  };

  const enviarSinal = (para: number, dados: unknown) => {
    socketRef.current?.send(JSON.stringify({ tipo: "sinal", para, dados }));
  };

  return { conectado, enviarMensagem, enviarSinal };
}

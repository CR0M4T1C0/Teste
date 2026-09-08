import { useEffect, useRef } from "react";
import { wsAdminUrl } from "@/app/lib/api";

type EventoAdmin = { evento: string; dados: unknown };

/** Conecta no /ws/admin e chama onEvento a cada mensagem recebida. Tenta
 * reconectar sozinho se a conexão cair (ex.: a API reiniciou). */
export function useAdminWebSocket(token: string | null, onEvento: (e: EventoAdmin) => void) {
  const onEventoRef = useRef(onEvento);
  onEventoRef.current = onEvento;

  useEffect(() => {
    if (!token) return;

    let socket: WebSocket | null = null;
    let timeoutReconexao: ReturnType<typeof setTimeout> | null = null;
    let cancelado = false;

    const conectar = () => {
      socket = new WebSocket(wsAdminUrl(token));
      socket.onmessage = (evento) => {
        try {
          onEventoRef.current(JSON.parse(evento.data));
        } catch {
          // mensagem que não é JSON válido — ignora
        }
      };
      socket.onclose = () => {
        if (!cancelado) timeoutReconexao = setTimeout(conectar, 3000);
      };
    };

    conectar();

    return () => {
      cancelado = true;
      if (timeoutReconexao) clearTimeout(timeoutReconexao);
      socket?.close();
    };
  }, [token]);
}

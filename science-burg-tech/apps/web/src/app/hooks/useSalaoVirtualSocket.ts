import { useEffect, useRef } from "react";
import { wsSalaoUrl } from "@/app/lib/api";

/** Conecta no feed público do salão (só avisa "uma mesa mudou de ocupação",
 * sem exigir login) — usado na tela de listagem das mesas virtuais para
 * atualizar sozinha, sem precisar de F5. Reconecta sozinho se cair. */
export function useSalaoVirtualSocket(onMudou: () => void) {
  const onMudouRef = useRef(onMudou);
  onMudouRef.current = onMudou;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timeoutReconexao: ReturnType<typeof setTimeout> | null = null;
    let cancelado = false;

    const conectar = () => {
      socket = new WebSocket(wsSalaoUrl());
      socket.onmessage = (evento) => {
        try {
          const { evento: tipo } = JSON.parse(evento.data);
          if (tipo === "mesa_atualizada") onMudouRef.current();
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
  }, []);
}

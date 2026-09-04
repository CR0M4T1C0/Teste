import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Administrador } from "@/app/types";
import { loginAdmin } from "@/app/lib/api";
import { tempoRestanteMs, tokenExpirado } from "@/app/lib/token";

const CHAVE_TOKEN = "bt_admin_token";
const CHAVE_ADMIN = "bt_admin_dados";

type AdminAuthContextValue = {
  administrador: Administrador | null;
  token: string | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [administrador, setAdministrador] = useState<Administrador | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const temporizador = useRef<number | null>(null);

  const limparSessao = useCallback(() => {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_ADMIN);
    setToken(null);
    setAdministrador(null);
    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  /**
   * Desloga sozinho no vencimento do token.
   *
   * No painel administrativo isto importa ainda mais que no site do cliente:
   * é uma tela que costuma ficar aberta o dia inteiro num computador do
   * balcão, à vista de qualquer um. A sessão expirar de verdade (e não só
   * "na aparência") é o que faz a validade de 8 horas ter algum efeito.
   */
  const agendarExpiracao = useCallback(
    (tokenAtual: string) => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
      const restante = tempoRestanteMs(tokenAtual);
      const TETO = 2_147_483_647; // teto do setTimeout (~24,8 dias)
      temporizador.current = window.setTimeout(limparSessao, Math.min(restante, TETO));
    },
    [limparSessao],
  );

  useEffect(() => {
    const tokenSalvo = localStorage.getItem(CHAVE_TOKEN);
    const adminSalvo = localStorage.getItem(CHAVE_ADMIN);

    if (tokenSalvo && adminSalvo) {
      if (tokenExpirado(tokenSalvo)) {
        limparSessao();
      } else {
        try {
          setToken(tokenSalvo);
          setAdministrador(JSON.parse(adminSalvo));
          agendarExpiracao(tokenSalvo);
        } catch {
          limparSessao();
        }
      }
    }
    setCarregando(false);
  }, [agendarExpiracao, limparSessao]);

  useEffect(() => {
    const aoMudarArmazenamento = (evento: StorageEvent) => {
      if (evento.key === CHAVE_TOKEN && evento.newValue === null) limparSessao();
    };
    window.addEventListener("storage", aoMudarArmazenamento);
    return () => window.removeEventListener("storage", aoMudarArmazenamento);
  }, [limparSessao]);

  useEffect(() => {
    return () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    };
  }, []);

  const login = async (email: string, senha: string) => {
    const resposta = await loginAdmin({ email, senha });
    localStorage.setItem(CHAVE_TOKEN, resposta.access_token);
    localStorage.setItem(CHAVE_ADMIN, JSON.stringify(resposta.administrador));
    setToken(resposta.access_token);
    setAdministrador(resposta.administrador);
    agendarExpiracao(resposta.access_token);
  };

  return (
    <AdminAuthContext.Provider
      value={{ administrador, token, carregando, login, logout: limparSessao }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const contexto = useContext(AdminAuthContext);
  if (!contexto) throw new Error("useAdminAuth precisa estar dentro de <AdminAuthProvider>");
  return contexto;
}

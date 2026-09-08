import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Usuario } from "@/app/types";
import { loginCliente, registarCliente } from "@/app/lib/api";
import { tempoRestanteMs, tokenExpirado } from "@/app/lib/token";

const CHAVE_TOKEN = "bt_cliente_token";
const CHAVE_USUARIO = "bt_cliente_usuario";

type ClienteAuthContextValue = {
  usuario: Usuario | null;
  token: string | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registar: (nome: string, email: string, senha: string, telefone?: string) => Promise<void>;
  logout: () => void;
};

const ClienteAuthContext = createContext<ClienteAuthContextValue | null>(null);

export function ClienteAuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Guarda o timer que desloga sozinho quando o token vence.
  const temporizador = useRef<number | null>(null);

  const limparSessao = useCallback(() => {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    setToken(null);
    setUsuario(null);
    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  /**
   * Agenda o logout para o exato momento em que o token vence.
   *
   * Sem isto, alguém que deixasse a aba aberta continuaria vendo a interface
   * de "logado" depois do vencimento, e só descobriria o problema quando
   * uma ação falhasse com 401 do nada.
   */
  const agendarExpiracao = useCallback(
    (tokenAtual: string) => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);

      const restante = tempoRestanteMs(tokenAtual);
      // setTimeout tem teto de ~24,8 dias; acima disso ele dispararia na hora.
      const TETO = 2_147_483_647;
      temporizador.current = window.setTimeout(limparSessao, Math.min(restante, TETO));
    },
    [limparSessao],
  );

  useEffect(() => {
    const tokenSalvo = localStorage.getItem(CHAVE_TOKEN);
    const usuarioSalvo = localStorage.getItem(CHAVE_USUARIO);

    if (tokenSalvo && usuarioSalvo) {
      // Só restaura a sessão se o token ainda for válido. Um token vencido
      // (ou lixo no localStorage) é descartado em vez de virar uma tela
      // logada que não funciona.
      if (tokenExpirado(tokenSalvo)) {
        limparSessao();
      } else {
        try {
          setToken(tokenSalvo);
          setUsuario(JSON.parse(usuarioSalvo));
          agendarExpiracao(tokenSalvo);
        } catch {
          // JSON corrompido no localStorage
          limparSessao();
        }
      }
    }
    setCarregando(false);
  }, [agendarExpiracao, limparSessao]);

  // Se o usuário deslogar em outra aba, esta aba acompanha.
  useEffect(() => {
    const aoMudarArmazenamento = (evento: StorageEvent) => {
      if (evento.key === CHAVE_TOKEN && evento.newValue === null) limparSessao();
    };
    window.addEventListener("storage", aoMudarArmazenamento);
    return () => window.removeEventListener("storage", aoMudarArmazenamento);
  }, [limparSessao]);

  // Garante que o timer não fica pendurado se o componente sair da tela.
  useEffect(() => {
    return () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    };
  }, []);

  const salvarSessao = (novoToken: string, novoUsuario: Usuario) => {
    localStorage.setItem(CHAVE_TOKEN, novoToken);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(novoUsuario));
    setToken(novoToken);
    setUsuario(novoUsuario);
    agendarExpiracao(novoToken);
  };

  const login = async (email: string, senha: string) => {
    const resposta = await loginCliente({ email, senha });
    salvarSessao(resposta.access_token, resposta.usuario);
  };

  const registar = async (nome: string, email: string, senha: string, telefone?: string) => {
    const resposta = await registarCliente({ nome, email, senha, telefone });
    salvarSessao(resposta.access_token, resposta.usuario);
  };

  return (
    <ClienteAuthContext.Provider
      value={{ usuario, token, carregando, login, registar, logout: limparSessao }}
    >
      {children}
    </ClienteAuthContext.Provider>
  );
}

export function useClienteAuth() {
  const contexto = useContext(ClienteAuthContext);
  if (!contexto) throw new Error("useClienteAuth precisa estar dentro de <ClienteAuthProvider>");
  return contexto;
}

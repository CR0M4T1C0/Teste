/**
 * Utilitários para inspecionar o token JWT guardado no navegador.
 *
 * IMPORTANTE: ler o conteúdo do token aqui NÃO é uma verificação de
 * segurança. A assinatura só pode ser conferida pelo back-end, que é quem
 * tem o segredo. O objetivo aqui é puramente de experiência de uso: se o
 * token já venceu, não faz sentido mostrar a tela como se o usuário
 * estivesse logado só para toda ação falhar com 401 depois. Quem decide se
 * um token vale ou não continua sendo sempre a API.
 */

type ConteudoToken = {
  exp?: number;
  [chave: string]: unknown;
};

/** Lê a parte do meio do JWT (o "payload"), que é só base64url + JSON. */
function lerConteudo(token: string): ConteudoToken | null {
  try {
    const parteDoMeio = token.split(".")[1];
    if (!parteDoMeio) return null;

    // base64url -> base64: troca os caracteres trocados e recoloca o padding.
    const base64 = parteDoMeio.replace(/-/g, "+").replace(/_/g, "/");
    const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    // decodeURIComponent/escape garante que acentos (ex.: no nome) não quebrem.
    const json = decodeURIComponent(
      atob(preenchido)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as ConteudoToken;
  } catch {
    // Token malformado, adulterado ou lixo no localStorage.
    return null;
  }
}

/**
 * Diz se o token já venceu (ou é inválido a ponto de não dar para ler).
 *
 * Usa uma margem de 30 segundos: se falta menos que isso para vencer, já
 * tratamos como vencido, evitando a corrida em que o token expira no meio
 * do caminho entre o navegador e a API.
 */
export function tokenExpirado(token: string, margemSegundos = 30): boolean {
  const conteudo = lerConteudo(token);
  if (!conteudo || typeof conteudo.exp !== "number") return true;

  const agoraEmSegundos = Date.now() / 1000;
  return conteudo.exp - margemSegundos <= agoraEmSegundos;
}

/** Milissegundos que faltam até o token vencer (0 se já venceu). */
export function tempoRestanteMs(token: string): number {
  const conteudo = lerConteudo(token);
  if (!conteudo || typeof conteudo.exp !== "number") return 0;
  return Math.max(0, conteudo.exp * 1000 - Date.now());
}

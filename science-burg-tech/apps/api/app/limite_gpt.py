"""Limite de uso do G.P.T., por visitante.

Diferente do limite de login (que existe contra força bruta), este existe
por um motivo financeiro: cada mensagem vira uma chamada paga ao provedor
de IA. Sem freio, um script simples esgotaria a cota do projeto — e, num
plano gratuito, derrubaria o atendente para todo mundo.

São dois freios ao mesmo tempo:
  - intervalo mínimo entre mensagens (evita rajada);
  - teto de mensagens por hora (evita uso contínuo abusivo).

Assim como o limite de login, a contagem vive na memória do processo. Serve
para esta API, que roda num processo só. Com vários workers, cada um teria
seu próprio contador — nesse cenário isto precisa virar Redis.
"""

import time
from threading import Lock

INTERVALO_MINIMO_SEGUNDOS = 3
MAXIMO_POR_HORA = 30
JANELA_SEGUNDOS = 3600

_usos: dict[str, list[float]] = {}
_trava = Lock()


def segundos_de_espera(chave: str) -> int:
    """Quantos segundos faltam até a próxima mensagem ser permitida (0 = livre)."""
    with _trava:
        agora = time.monotonic()
        registros = [t for t in _usos.get(chave, []) if agora - t < JANELA_SEGUNDOS]
        if registros:
            _usos[chave] = registros
        else:
            _usos.pop(chave, None)

        if not registros:
            return 0

        desde_a_ultima = agora - registros[-1]
        if desde_a_ultima < INTERVALO_MINIMO_SEGUNDOS:
            return int(INTERVALO_MINIMO_SEGUNDOS - desde_a_ultima) + 1

        if len(registros) >= MAXIMO_POR_HORA:
            # Livre quando o registro mais antigo sair da janela de uma hora.
            return int(JANELA_SEGUNDOS - (agora - registros[0])) + 1

        return 0


def registrar_uso(chave: str) -> None:
    with _trava:
        _usos.setdefault(chave, []).append(time.monotonic())


def limpar_tudo() -> None:
    """Usado pelos testes, para um teste não interferir no outro."""
    with _trava:
        _usos.clear()

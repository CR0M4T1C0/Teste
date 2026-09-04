"""Proteção simples contra força bruta nas telas de login e registo.

Sem isto, nada impede um script de tentar 10.000 senhas por minuto contra
/api/auth/login ou /api/admin/auth/login. O bcrypt já torna cada tentativa
lenta, mas lento não é o mesmo que bloqueado.

A contagem é feita em memória (um dicionário no processo). É o suficiente
para uma API que roda num processo só, como esta. Se um dia o projeto for
para vários workers ou várias máquinas, isto precisa virar Redis — está
anotado no README.
"""

import time
from threading import Lock

# Quantas tentativas erradas são toleradas dentro da janela, por chave
MAXIMO_TENTATIVAS = 5

# Tamanho da janela de contagem, em segundos (15 minutos)
JANELA_SEGUNDOS = 15 * 60

# Quanto tempo a chave fica bloqueada depois de estourar o limite (15 minutos)
BLOQUEIO_SEGUNDOS = 15 * 60

# De quanto em quanto tempo, no máximo, varremos os dois dicionários
# procurando chaves mortas (ver _limpar_chaves_mortas).
INTERVALO_LIMPEZA_SEGUNDOS = 5 * 60

_tentativas: dict[str, list[float]] = {}
_bloqueios: dict[str, float] = {}
_trava = Lock()
_ultima_limpeza = 0.0


def _limpar_antigas(chave: str, agora: float) -> None:
    """Descarta tentativas que já saíram da janela de tempo, para uma chave."""
    registros = _tentativas.get(chave)
    if registros is None:
        return
    recentes = [t for t in registros if agora - t < JANELA_SEGUNDOS]
    if recentes:
        _tentativas[chave] = recentes
    else:
        _tentativas.pop(chave, None)


def _limpar_chaves_mortas(agora: float) -> None:
    """Varre os dois dicionários inteiros removendo o que já não serve mais.

    A `_limpar_antigas` acima só limpa a chave que está sendo usada naquele
    momento. Uma chave que apareceu uma vez e nunca mais foi consultada
    (ex.: um ataque de enumeração que tenta cada e-mail só uma vez, de um
    IP diferente a cada tentativa) ficaria para sempre nos dicionários,
    mesmo expirada — em memória, isso cresce sem limite enquanto o processo
    roda. Por isso esta varredura completa roda periodicamente, não a cada
    chamada: o custo de percorrer os dicionários inteiros só vale a pena de
    tempos em tempos, não a cada tentativa de login.
    """
    global _ultima_limpeza
    if agora - _ultima_limpeza < INTERVALO_LIMPEZA_SEGUNDOS:
        return
    _ultima_limpeza = agora

    for chave in list(_bloqueios):
        if agora >= _bloqueios[chave]:
            _bloqueios.pop(chave, None)
            _tentativas.pop(chave, None)

    for chave in list(_tentativas):
        _limpar_antigas(chave, agora)


def segundos_de_bloqueio(chave: str) -> int:
    """Devolve quantos segundos faltam de bloqueio (0 = liberado)."""
    with _trava:
        agora = time.monotonic()
        expira_em = _bloqueios.get(chave)
        if expira_em is None:
            return 0
        if agora >= expira_em:
            _bloqueios.pop(chave, None)
            _tentativas.pop(chave, None)
            return 0
        return int(expira_em - agora) + 1


def registrar_falha(chave: str) -> None:
    """Conta mais uma tentativa errada e bloqueia se passar do limite."""
    with _trava:
        agora = time.monotonic()
        _limpar_chaves_mortas(agora)
        _limpar_antigas(chave, agora)
        _tentativas.setdefault(chave, []).append(agora)

        if len(_tentativas[chave]) >= MAXIMO_TENTATIVAS:
            _bloqueios[chave] = agora + BLOQUEIO_SEGUNDOS
            _tentativas.pop(chave, None)


def registrar_sucesso(chave: str) -> None:
    """Login deu certo: zera o histórico daquela chave."""
    with _trava:
        _tentativas.pop(chave, None)
        _bloqueios.pop(chave, None)


def limpar_tudo() -> None:
    """Usado pelos testes, para um teste não interferir no outro."""
    global _ultima_limpeza
    with _trava:
        _tentativas.clear()
        _bloqueios.clear()
        _ultima_limpeza = 0.0

# Painel de teste — Network da Fome

Página HTML avulsa (sem npm, sem build) para testar a API do recurso
"Network da Fome" rapidamente, incluindo o chat em tempo real. Útil
para validar o back-end antes mesmo do front-end React estar pronto, ou
para depurar um problema isolando-o do resto do site.

## Como usar

1. Suba a API normalmente (`uvicorn app.main:app --reload`, na pasta `apps/api`).
2. Sirva esta pasta com um servidor HTTP simples **na porta 5173**, que já
   vem liberada no CORS por padrão (`CORS_ORIGINS` no `.env`):

   ```bash
   cd apps/api/ferramentas-teste
   python3 -m http.server 5173
   ```

3. Abra **duas abas** (ou dois navegadores/perfis) em `http://localhost:5173/network-da-fome.html`.
4. Em cada aba, registre (ou entre com) uma conta diferente.
5. Clique em "Sentar" na mesma mesa nas duas abas — mande mensagens de
   uma aba e veja aparecer na outra na hora.

> Se abrir o arquivo direto (`file://…`) em vez de servir pela porta 5173,
> o navegador vai bloquear as requisições por CORS — sempre sirva por
> HTTP numa origem que esteja em `CORS_ORIGINS`.

## O que dá para testar aqui

- Registro/login de cliente
- Listar mesas do salão com ocupação
- Sentar (e ver o 409 quando a mesa está lotada ou o lugar já está ocupado)
- Chat em tempo real via WebSocket (mensagens aparecem para todos na mesa)
- Sair da mesa (o lugar libera na hora para outra aba)
- Denunciar e bloquear um usuário (por id — veja os ids nas mensagens/lugares)

Não testa a parte de voz (WebRTC) — isso está só na página React
(`/network-da-fome` → `/mesa-virtual/:id`), porque depende de captura de
microfone e várias conexões `RTCPeerConnection`, o que não cabe numa
paginazinha de teste simples.

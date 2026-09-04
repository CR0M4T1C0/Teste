// Os produtos e categorias agora vêm da API (GET /api/produtos, GET
// /api/categorias — veja @/app/hooks/useCardapio). Este arquivo só guarda o
// que continua sendo puramente visual/estático no front-end: as imagens de
// fallback (o banco não tem imagem própria pra cada produto do seed) e os
// slides do carrossel da home.

// ─── IMAGENS DE FALLBACK, por slug de produto ─────────────────────────────
export const IMG_FALLBACK: Record<string, string> = {
  "github-burger": "https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=700&h=560&fit=crop&auto=format",
  "javascript-burger": "https://images.unsplash.com/photo-1667329829058-ac191ba4a905?w=700&h=560&fit=crop&auto=format",
  "html-burger": "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=700&h=560&fit=crop&auto=format",
  "css-burger": "https://images.unsplash.com/photo-1603893662172-99ed0cea2a08?w=700&h=560&fit=crop&auto=format",
  "cpp-burger": "https://images.unsplash.com/photo-1606131731446-5568d87113aa?w=700&h=560&fit=crop&auto=format",
  "python-burger": "https://images.unsplash.com/photo-1547584370-2cc98b8b8dc8?w=700&h=560&fit=crop&auto=format",
  "cache-de-batatas": "https://images.unsplash.com/photo-1688978181542-87a886a16fbe?w=700&h=560&fit=crop&auto=format",
  "overflow-de-aneis": "https://images.unsplash.com/photo-1639024471283-03518883512d?w=700&h=560&fit=crop&auto=format",
  "stack-de-nuggets": "https://images.unsplash.com/photo-1762922425249-144c3bb9167e?w=700&h=560&fit=crop&auto=format",
  "blue-screen-of-death": "https://images.unsplash.com/photo-1773798795857-15c230fd2e43?w=700&h=560&fit=crop&auto=format",
  "null-pointer": "https://images.unsplash.com/photo-1777993623617-abc6adebea40?w=700&h=560&fit=crop&auto=format",
  "dark-mode": "https://images.unsplash.com/photo-1767065703486-32be4d8a0a4b?w=700&h=560&fit=crop&auto=format",
  "cookie-overflow": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=700&h=560&fit=crop&auto=format",
  "ice-cream-compiler": "https://images.unsplash.com/photo-1614014077943-840960ce6694?w=700&h=560&fit=crop&auto=format",
};

export const IMG_PLACEHOLDER =
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&h=560&fit=crop&auto=format";

// ─── SLIDES DO HERO (conteúdo de marketing, não vem do banco) ─────────────
export const HERO_SLIDES = [
  {
    id: 0,
    titulo: "COMMIT SEU\nPEDIDO AGORA",
    sub: "A hamburgueria onde cada mordida é um deploy de sabor",
    cta: "Ver Cardápio",
    cor: "from-orange-950/90",
    img: IMG_FALLBACK["github-burger"],
    produtoSlug: "github-burger",
  },
  {
    id: 1,
    titulo: "PERFORMANCE\nMÁXIMA",
    sub: "O C++ Burger compila na brasa. Zero garbage, 100% sabor",
    cta: "Pedir Agora",
    cor: "from-red-950/90",
    img: IMG_FALLBACK["cpp-burger"],
    produtoSlug: "cpp-burger",
  },
  {
    id: 2,
    titulo: "DARK MODE\nATIVADO",
    sub: "Ambiente tech, hambúrgueres artesanais e Wi-Fi grátis",
    cta: "Explorar Menu",
    cor: "from-zinc-950/90",
    img: IMG_FALLBACK["javascript-burger"],
    produtoSlug: "javascript-burger",
  },
];

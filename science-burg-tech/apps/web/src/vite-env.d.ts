/// <reference types="vite/client" />

// Sem estas declarações, o TypeScript não sabe o que é um `import foto from
// "./foto.png"` — o Vite entende (devolve a URL final do arquivo), mas o
// compilador reclamava "Cannot find module ... or its corresponding type
// declarations". O `vite/client` acima já cobre a maioria dos formatos; as
// linhas abaixo ficam explícitas para os que o projeto realmente usa.

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

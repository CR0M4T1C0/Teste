import { useEffect, useState } from "react";
import { getCategorias, getProdutos, type CategoriaApi, type ProdutoApi } from "@/app/lib/api";
import { IMG_FALLBACK, IMG_PLACEHOLDER } from "@/app/data/menu";
import type { Cat, Item } from "@/app/types";

export type CategoriaCardapio = { id: Cat; label: string; emoji: string };

type CardapioData = {
  categorias: CategoriaCardapio[];
  itensPorCategoria: Record<Cat, Item[]>;
  todosItens: Item[];
};

function produtoParaItem(produto: ProdutoApi): Item {
  return {
    id: produto.id,
    slug: produto.slug,
    nome: produto.nome,
    preco: produto.preco,
    img: produto.imagem_url || IMG_FALLBACK[produto.slug] || IMG_PLACEHOLDER,
    kcal: produto.calorias,
    tag: produto.tag,
    descricao: produto.descricao || "",
    badge: produto.cor_badge || undefined,
  };
}

function montarCardapio(categoriasApi: CategoriaApi[], produtosApi: ProdutoApi[]): CardapioData {
  const categorias: CategoriaCardapio[] = categoriasApi.map((c) => ({
    id: c.slug as Cat,
    label: c.nome,
    emoji: c.emoji || "",
  }));

  const itensPorCategoria = {} as Record<Cat, Item[]>;
  for (const categoria of categorias) itensPorCategoria[categoria.id] = [];

  const todosItens: Item[] = [];
  for (const produto of produtosApi) {
    const item = produtoParaItem(produto);
    todosItens.push(item);
    const cat = produto.categoria_slug as Cat;
    if (!itensPorCategoria[cat]) itensPorCategoria[cat] = [];
    itensPorCategoria[cat].push(item);
  }

  return { categorias, itensPorCategoria, todosItens };
}

// Cache simples em memória: várias seções da home usam useCardapio() ao
// mesmo tempo (Hero, Destaques, Preview do cardápio) — sem isso, cada uma
// dispararia a mesma requisição de novo.
let cardapioCache: CardapioData | null = null;
let cardapioEmVoo: Promise<CardapioData> | null = null;

function buscarCardapio(): Promise<CardapioData> {
  if (cardapioCache) return Promise.resolve(cardapioCache);
  if (!cardapioEmVoo) {
    cardapioEmVoo = Promise.all([getCategorias(), getProdutos()]).then(([categorias, produtos]) => {
      cardapioCache = montarCardapio(categorias, produtos);
      return cardapioCache;
    });
  }
  return cardapioEmVoo;
}

export function useCardapio() {
  const [dados, setDados] = useState<CardapioData | null>(cardapioCache);
  const [carregando, setCarregando] = useState(!cardapioCache);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (dados) return;
    let cancelado = false;
    buscarCardapio()
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao carregar o cardápio");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [dados]);

  return {
    categorias: dados?.categorias ?? [],
    itensPorCategoria: dados?.itensPorCategoria ?? ({} as Record<Cat, Item[]>),
    todosItens: dados?.todosItens ?? [],
    carregando,
    erro,
  };
}

import { useEffect, useState } from "react";
import { getCombos } from "@/app/lib/api";
import { IMG_PLACEHOLDER } from "@/app/data/menu";
import type { Combo } from "@/app/types";

let cache: Combo[] | null = null;
let emVoo: Promise<Combo[]> | null = null;

function buscarCombos(): Promise<Combo[]> {
  if (cache) return Promise.resolve(cache);
  if (!emVoo) {
    emVoo = getCombos().then((lista) => {
      cache = lista.map((c) => ({
        id: c.id,
        nome: c.nome,
        slug: c.slug,
        descricao: c.descricao,
        preco: c.preco,
        img: c.imagem_url || IMG_PLACEHOLDER,
        disponivel: c.disponivel,
        itens: c.itens.map((i) => ({ produtoId: i.produto_id, nome: i.nome, quantidade: i.quantidade })),
      }));
      return cache;
    });
  }
  return emVoo;
}

export function useCombos() {
  const [combos, setCombos] = useState<Combo[]>(cache ?? []);
  const [carregando, setCarregando] = useState(!cache);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelado = false;
    buscarCombos()
      .then((resultado) => {
        if (!cancelado) setCombos(resultado);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar os combos");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { combos, carregando, erro };
}

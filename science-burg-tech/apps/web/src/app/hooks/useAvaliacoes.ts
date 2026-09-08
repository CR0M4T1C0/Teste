import { useEffect, useState } from "react";
import { getAvaliacoes, type AvaliacaoApi } from "@/app/lib/api";

let cache: AvaliacaoApi[] | null = null;
let emVoo: Promise<AvaliacaoApi[]> | null = null;

function buscarAvaliacoes(): Promise<AvaliacaoApi[]> {
  if (cache) return Promise.resolve(cache);
  if (!emVoo) emVoo = getAvaliacoes().then((lista) => (cache = lista));
  return emVoo;
}

export function useAvaliacoes() {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoApi[]>(cache ?? []);
  const [carregando, setCarregando] = useState(!cache);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelado = false;
    buscarAvaliacoes()
      .then((resultado) => {
        if (!cancelado) setAvaliacoes(resultado);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar as avaliações");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { avaliacoes, carregando, erro };
}

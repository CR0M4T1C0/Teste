import { useEffect, useState } from "react";
import { getPromocoes, type PromocaoApi } from "@/app/lib/api";

let cache: PromocaoApi[] | null = null;
let emVoo: Promise<PromocaoApi[]> | null = null;

function buscarPromocoes(): Promise<PromocaoApi[]> {
  if (cache) return Promise.resolve(cache);
  if (!emVoo) emVoo = getPromocoes().then((lista) => (cache = lista));
  return emVoo;
}

export function usePromocoes() {
  const [promocoes, setPromocoes] = useState<PromocaoApi[]>(cache ?? []);
  const [carregando, setCarregando] = useState(!cache);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelado = false;
    buscarPromocoes()
      .then((resultado) => {
        if (!cancelado) setPromocoes(resultado);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar as promoções");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return { promocoes, carregando, erro };
}

import { useState } from "react";
import type { Combo, Item, Pedido } from "@/app/types";

export function useCart() {
  const [cart, setCart] = useState<Pedido[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const addCart = (item: Item) => {
    setCart((p) => {
      const ex = p.find((i) => i.id === item.id && i.tipo === "produto");
      return ex
        ? p.map((i) => (i.id === item.id && i.tipo === "produto" ? { ...i, qty: i.qty + 1 } : i))
        : [...p, { id: item.id, tipo: "produto" as const, nome: item.nome, preco: item.preco, qty: 1 }];
    });
  };

  const addComboCart = (combo: Combo) => {
    setCart((p) => {
      const ex = p.find((i) => i.id === combo.id && i.tipo === "combo");
      return ex
        ? p.map((i) => (i.id === combo.id && i.tipo === "combo" ? { ...i, qty: i.qty + 1 } : i))
        : [...p, { id: combo.id, tipo: "combo" as const, nome: combo.nome, preco: combo.preco, qty: 1 }];
    });
  };

  // "id" sozinho não basta pra identificar um item do carrinho: um produto
  // id=3 e um combo id=3 são coisas diferentes, por isso tudo aqui também
  // compara "tipo".
  const changeQty = (id: number, tipo: "produto" | "combo", d: number) =>
    setCart((p) => p.map((i) => (i.id === id && i.tipo === tipo ? { ...i, qty: i.qty + d } : i)).filter((i) => i.qty > 0));

  const clearCart = () => setCart([]);

  /** Usado por "Pedir de novo": recoloca de uma vez os itens de um pedido
   * passado no carrinho, somando com o que já estiver lá (não substitui). */
  const adicionarVarios = (itens: Pedido[]) => {
    setCart((p) => {
      const resultado = [...p];
      for (const item of itens) {
        const i = resultado.findIndex((r) => r.id === item.id && r.tipo === item.tipo);
        if (i >= 0) resultado[i] = { ...resultado[i], qty: resultado[i].qty + item.qty };
        else resultado.push(item);
      }
      return resultado;
    });
  };

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrc = cart.reduce((s, i) => s + i.preco * i.qty, 0);

  return { cart, cartOpen, setCartOpen, addCart, addComboCart, changeQty, clearCart, adicionarVarios, totalQty, totalPrc };
}

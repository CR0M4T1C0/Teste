import { useState } from "react";
import { CardapioSection, type CategoriaOuCombo } from "@/app/components/sections/CardapioSection";
import { useCartContext } from "@/app/hooks/useCartContext";

export function CardapioPage() {
  const [cat, setCat] = useState<CategoriaOuCombo>("hamburguer");
  const { addCart, addComboCart } = useCartContext();

  return <CardapioSection cat={cat} onChangeCat={setCat} onAdd={addCart} onAddCombo={addComboCart} />;
}

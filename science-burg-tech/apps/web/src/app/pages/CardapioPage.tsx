import { useState } from "react";
import { CardapioSection } from "@/app/components/sections/CardapioSection";
import { useCartContext } from "@/app/hooks/useCartContext";
import type { Cat } from "@/app/types";

export function CardapioPage() {
  const [cat, setCat] = useState<Cat>("hamburguer");
  const { addCart } = useCartContext();

  return <CardapioSection cat={cat} onChangeCat={setCat} onAdd={addCart} />;
}

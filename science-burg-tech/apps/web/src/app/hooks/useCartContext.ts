import { useOutletContext } from "react-router";
import type { CartContext } from "@/app/types";

export function useCartContext() {
  return useOutletContext<CartContext>();
}

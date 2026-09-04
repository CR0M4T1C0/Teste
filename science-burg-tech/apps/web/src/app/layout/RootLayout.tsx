import { Outlet } from "react-router";
import { TickerBar } from "@/app/components/layout/TickerBar";
import { Header } from "@/app/components/layout/Header";
import { Footer } from "@/app/components/layout/Footer";
import { CartDrawer } from "@/app/components/layout/CartDrawer";
import { useCart } from "@/app/hooks/useCart";
import type { CartContext } from "@/app/types";

export function RootLayout() {
  const { cart, cartOpen, setCartOpen, addCart, changeQty, clearCart, adicionarVarios, totalQty, totalPrc } = useCart();

  const context: CartContext = { cart, addCart, changeQty, clearCart, adicionarVarios, totalQty, totalPrc };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ fontFamily: "'Inter',sans-serif" }}>
      <TickerBar />
      <Header totalQty={totalQty} onOpenCart={() => setCartOpen(true)} />
      <Outlet context={context} />
      <Footer />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        totalQty={totalQty}
        totalPrc={totalPrc}
        onChangeQty={changeQty}
        onClearCart={clearCart}
      />
    </div>
  );
}

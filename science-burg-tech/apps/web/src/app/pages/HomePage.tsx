import { HeroSection } from "@/app/components/sections/HeroSection";
import { DestaquesSection } from "@/app/components/sections/DestaquesSection";
import { CardapioPreviewSection } from "@/app/components/sections/CardapioPreviewSection";
import { DiferenciaisSection } from "@/app/components/sections/DiferenciaisSection";
import { DepoimentosSection } from "@/app/components/sections/DepoimentosSection";
import { useCartContext } from "@/app/hooks/useCartContext";

// "Sobre Nós" e "Localização" têm páginas próprias (/sobre e /localizacao,
// já linkadas no header e no rodapé) com o mesmo conteúdo — por isso não
// duplicamos essas seções aqui na Home.
export function HomePage() {
  const { addCart } = useCartContext();

  return (
    <>
      <HeroSection onAdd={addCart} />
      <DestaquesSection onAdd={addCart} />
      <CardapioPreviewSection onAdd={addCart} />
      <DiferenciaisSection />
      <DepoimentosSection />
    </>
  );
}

import { HeroSection } from "@/app/components/sections/HeroSection";
import { DestaquesSection } from "@/app/components/sections/DestaquesSection";
import { CardapioPreviewSection } from "@/app/components/sections/CardapioPreviewSection";
import { DiferenciaisSection } from "@/app/components/sections/DiferenciaisSection";
import { SobreSection } from "@/app/components/sections/SobreSection";
import { DepoimentosSection } from "@/app/components/sections/DepoimentosSection";
import { LocalizacaoSection } from "@/app/components/sections/LocalizacaoSection";
import { useCartContext } from "@/app/hooks/useCartContext";

export function HomePage() {
  const { addCart } = useCartContext();

  return (
    <>
      <HeroSection onAdd={addCart} />
      <DestaquesSection onAdd={addCart} />
      <CardapioPreviewSection onAdd={addCart} />
      <DiferenciaisSection />
      <SobreSection />
      <DepoimentosSection />
      <LocalizacaoSection />
    </>
  );
}

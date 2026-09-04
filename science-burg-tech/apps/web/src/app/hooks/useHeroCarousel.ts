import { useEffect, useRef, useState } from "react";

export function useHeroCarousel(slideCount: number, intervalMs = 5000) {
  const [slide, setSlide] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setSlide((s) => (s + 1) % slideCount), intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [slideCount, intervalMs]);

  const goSlide = (i: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSlide(i);
    intervalRef.current = setInterval(() => setSlide((s) => (s + 1) % slideCount), intervalMs);
  };

  return { slide, goSlide };
}

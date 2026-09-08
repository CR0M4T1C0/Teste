import { useEffect, useRef, useState } from "react";

export function useCarousel(slideCount: number, intervalMs = 5000, pausado = false) {
  const [slide, setSlide] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pausado) return;
    intervalRef.current = setInterval(() => setSlide((s) => (s + 1) % slideCount), intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [slideCount, intervalMs, pausado]);

  const goSlide = (i: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSlide(i);
    if (!pausado) {
      intervalRef.current = setInterval(() => setSlide((s) => (s + 1) % slideCount), intervalMs);
    }
  };

  return { slide, goSlide };
}

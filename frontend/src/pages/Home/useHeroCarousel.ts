import { useCallback, useEffect, useState } from "react";
import { HERO_CAROUSEL_SLIDES } from "./components/homeData";

const ROTATE_MS = 6000;

export const useHeroCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
    setPaused(true);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_CAROUSEL_SLIDES.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  return { activeIndex, goToSlide, paused, reducedMotion, togglePause: () => setPaused(value => !value) };
};

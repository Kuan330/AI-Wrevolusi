import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { HERO_CAROUSEL_SLIDES } from "./homeData";

const ROTATE_MS = 6000;

export const HeroCarouselBackground = ({ activeIndex }: { activeIndex: number }) => {
  return (
    <div className="landing-hero-carousel" aria-hidden="true">
      {HERO_CAROUSEL_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={cn("landing-hero-carousel__slide", index === activeIndex && "is-active")}
          style={{ backgroundImage: `url(${slide.src})` }}
        />
      ))}
      <div className="landing-hero-carousel__overlay" />
    </div>
  );
};

type HeroCarouselDotsProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
};

export const HeroCarouselDots = ({ activeIndex, onSelect }: HeroCarouselDotsProps) => {
  return (
    <div className="landing-hero-carousel__dots" role="tablist" aria-label="Hero image carousel">
      {HERO_CAROUSEL_SLIDES.map((slide, index) => (
        <button
          key={slide.id}
          type="button"
          role="tab"
          className={cn("landing-hero-carousel__dot", index === activeIndex && "is-active")}
          aria-label={`Show slide ${index + 1}: ${slide.alt}`}
          aria-selected={index === activeIndex}
          onClick={() => onSelect(index)}
        />
      ))}
    </div>
  );
};

const HeroCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_CAROUSEL_SLIDES.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [activeIndex]);

  return (
    <>
      <HeroCarouselBackground activeIndex={activeIndex} />
      <HeroCarouselDots activeIndex={activeIndex} onSelect={goToSlide} />
    </>
  );
};

export default HeroCarousel;

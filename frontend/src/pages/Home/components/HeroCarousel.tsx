import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { HERO_CAROUSEL_SLIDES } from "./homeData";

import { useHeroCarousel } from "../useHeroCarousel";

export const HeroCarouselBackground = (props: { activeIndex: number }) => {
  const { activeIndex } = props;
  return (
    <div className="landing-hero-carousel" aria-hidden="true">
      {HERO_CAROUSEL_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={cn(
            "landing-hero-carousel__slide",
            index === activeIndex && "is-active",
          )}
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
  paused: boolean;
  onTogglePause?: () => void;
};

export const HeroCarouselDots = (props: HeroCarouselDotsProps) => {
  const { activeIndex, onSelect, paused, onTogglePause } = props;
  return (
    <div
      className="landing-hero-carousel__dots"
      role="group"
      aria-label="Hero image controls"
    >
      {HERO_CAROUSEL_SLIDES.map((slide, index) => (
        <button
          key={slide.id}
          type="button"
          className={cn(
            "landing-hero-carousel__dot",
            index === activeIndex && "is-active",
          )}
          aria-label={`Show slide ${index + 1}: ${slide.alt}`}
          aria-pressed={index === activeIndex}
          onClick={() => onSelect(index)}
        />
      ))}
      {onTogglePause && <button type="button" className="landing-hero-carousel__pause" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? "Resume images" : "Pause images"}
      </button>}
    </div>
  );
};


const HeroCarousel = () => {
  const { activeIndex, goToSlide, paused, reducedMotion, togglePause } = useHeroCarousel();

  const heroCarouselDotsProps1 = {
    activeIndex: activeIndex,
    onSelect: goToSlide,
    paused,
    onTogglePause: reducedMotion ? undefined : togglePause,
  } satisfies Partial<ComponentProps<typeof HeroCarouselDots>>;
  return (
    <>
      <HeroCarouselBackground activeIndex={activeIndex} />
      <HeroCarouselDots {...heroCarouselDotsProps1} />
    </>
  );
};

export default HeroCarousel;

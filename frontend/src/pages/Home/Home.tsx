import { useEffect, type ComponentProps } from "react";

import {
  HeroCarouselBackground,
  HeroCarouselDots,
} from "@/pages/Home/components/HeroCarousel";
import {
  CtaSection,
  HeroSection,
  LandingFooter,
  LandingNav,
  ReportSection,
  StepsSection,
  TestimonialsSection,
  TrustBar,
} from "./components";
import ScrollReveal from "@/components/ui/scroll-reveal";

import { useHeroCarousel } from "./useHeroCarousel";

import "./home.css";

const Home = () => {
  useEffect(() => { document.title = "AI-Wrevolusi — Your work. Your next move."; }, []);
  const { activeIndex, goToSlide, paused, reducedMotion, togglePause } = useHeroCarousel();

  const heroCarouselDotsProps1 = {
    activeIndex,
    onSelect: goToSlide,
    paused,
    onTogglePause: reducedMotion ? undefined : togglePause,
  } satisfies Partial<ComponentProps<typeof HeroCarouselDots>>;
  return (
    <div className="landing-page">
      <LandingNav />
      <div className="landing-hero-scene">
        <HeroCarouselBackground activeIndex={activeIndex} />
        <ScrollReveal threshold={0.05}>
          <HeroSection />
        </ScrollReveal>
        <ScrollReveal delay={40}>
          <div className="hero-trust-area">
            <TrustBar />
            <HeroCarouselDots {...heroCarouselDotsProps1} />
          </div>
        </ScrollReveal>
      </div>
      <ScrollReveal delay={80}>
        <StepsSection />
      </ScrollReveal>
      <ScrollReveal delay={120}>
        <ReportSection />
      </ScrollReveal>
      <ScrollReveal delay={160}>
        <TestimonialsSection />
      </ScrollReveal>
      <ScrollReveal delay={200}>
        <CtaSection />
      </ScrollReveal>
      <ScrollReveal delay={220}>
        <LandingFooter />
      </ScrollReveal>
    </div>
  );
};

export default Home;

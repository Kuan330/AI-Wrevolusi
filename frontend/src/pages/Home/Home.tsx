import { useCallback, useEffect, useState } from "react";

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
import { HERO_CAROUSEL_SLIDES } from "./components/homeData";
import ScrollReveal from "@/components/ui/scroll-reveal";

import "./home.css";

const ROTATE_MS = 6000;

const Home = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  const goToSlide = useCallback((index: number) => {
    setActiveSlide(index);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % HERO_CAROUSEL_SLIDES.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [activeSlide]);

  return (
    <div className="landing-page">
      <LandingNav />
      <div className="landing-hero-scene">
        <HeroCarouselBackground activeIndex={activeSlide} />
        <ScrollReveal threshold={0.05}>
          <HeroSection />
        </ScrollReveal>
        <ScrollReveal delay={40}>
          <div className="hero-trust-area">
            <TrustBar />
            <HeroCarouselDots activeIndex={activeSlide} onSelect={goToSlide} />
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

import { useEffect } from "react";

import {
  CtaSection,
  FaqSection,
  HeroSection,
  ImpactSection,
  LandingFooter,
  LandingNav,
  LearningPlanSection,
  PossibilitiesSection,
  ProgressSection,
  StepsSection,
} from "./components";
import ScrollReveal from "@/components/ui/scroll-reveal";

import "./home.css";

const Home = () => {
  useEffect(() => { document.title = "AI-Wrevolusi — Your work. Your next move."; }, []);
  return (
    <div className="landing-page">
      <LandingNav />
      <div className="landing-hero-scene">
        <ScrollReveal threshold={0.05}>
          <HeroSection />
        </ScrollReveal>
      </div>
      <StepsSection />
      <ImpactSection />
      <LearningPlanSection />
      <ProgressSection />
      <PossibilitiesSection />
      <FaqSection />
      <ScrollReveal className="home-reveal" threshold={0.12}>
        <CtaSection />
      </ScrollReveal>
      <LandingFooter />
    </div>
  );
};

export default Home;

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

import "./home.css";

const Home = () => {
  return (
    <div className="landing-page">
      <LandingNav />
      <ScrollReveal threshold={0.05}>
        <HeroSection />
      </ScrollReveal>
      <ScrollReveal delay={40}>
        <TrustBar />
      </ScrollReveal>
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

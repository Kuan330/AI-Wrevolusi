export interface HomeNavLink {
  href: string;
  label: string;
}

export interface HeroCarouselSlide {
  id: string;
  src: string;
  alt: string;
}

export const HERO_CAROUSEL_SLIDES: HeroCarouselSlide[] = [
  {
    id: "slide-01",
    src: "/images/carousel/slide-01.png",
    alt: "Malaysian professional woman working with AI tools",
  },
  {
    id: "slide-02",
    src: "/images/carousel/slide-02.png",
    alt: "Malaysian professional woman reviewing changing work tasks",
  },
  {
    id: "slide-03",
    src: "/images/carousel/slide-03.png",
    alt: "Malaysian women professionals collaborating in an office",
  },
  {
    id: "slide-04",
    src: "/images/carousel/slide-04.png",
    alt: "Malaysian professional woman planning her next career step",
  },
];

export const NAV_LINKS: HomeNavLink[] = [
  { href: "#steps", label: "How it works" },
];

export const TRUST_ITEMS = [
  "No CV upload",
  "Based on your actual tasks",
];

export const FOOTER_CONTACT = {
  projectName: "AI-Wrevolusi",
  teamName: "United6",
  teamMeta: "FIT5120 Team 11",
};

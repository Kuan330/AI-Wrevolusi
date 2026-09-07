export interface HomeNavLink {
  href: string;
  label: string;
}

export interface StepItem {
  title: string;
  description: string;
  accent: "warm" | "blue";
}

export interface StepEvidenceItem {
  label: string;
  detail: string;
}

export interface TestimonialItem {
  avatar: string;
  name: string;
  role: string;
  quote: string;
}

export interface FooterLinkItem {
  href?: string;
  label: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLinkItem[];
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
  { href: "#report", label: "Sample report" },
];

export const TRUST_ITEMS = [
  "No CV upload",
  "Based on your actual tasks",
];

export const STEPS: StepItem[] = [
  {
    title: "Record your real work.",
    description: "Choose an occupation and adjust its tasks to match your working day.",
    accent: "warm",
  },
  {
    title: "See where AI may change tasks.",
    description: "Review task-level evidence for AI assistance, reshaping or human-led work.",
    accent: "blue",
  },
  {
    title: "Make your skills visible.",
    description: "Connect your work to skills whose value can grow, stay steady or shift.",
    accent: "warm",
  },
  {
    title: "Explore your next options.",
    description: "Find occupations where your current strengths can transfer.",
    accent: "blue",
  },
  {
    title: "Build a plan that fits your life.",
    description: "Turn your choices into practical learning steps around your real constraints.",
    accent: "warm",
  },
];

export const STEP_EVIDENCE: StepEvidenceItem[] = [
  {
    label: "MASCO",
    detail: "Malaysia's official occupation classification helps anchor your work profile.",
  },
  {
    label: "ILO",
    detail: "Task-level evidence shows where generative AI may change work.",
  },
  {
    label: "WEF",
    detail: "Future of Jobs 2025 informs the skills and opportunity view.",
  },
];

export const REPORT_ROWS = [
  {
    task: "Competitor research",
    influence: "Higher",
    influenceClass: "tag tag-high",
    suggestion: "Let AI draft first",
  },
  {
    task: "Cross-team coordination",
    influence: "Lower",
    influenceClass: "tag tag-low",
    suggestion: "Keep building influence",
  },
  {
    task: "Strategy judgement",
    influence: "AI-assisted",
    influenceClass: "tag tag-assist",
    suggestion: "You keep the decision",
  },
];

export const ACTION_PLAN = [
  { period: "Days 1-30", detail: "Learn an AI research workflow" },
  { period: "Days 31-60", detail: "Finish one real project" },
  { period: "Days 61-90", detail: "Capture the outcome and show its value" },
];

export const TESTIMONIALS: TestimonialItem[] = [
  {
    avatar: "A",
    name: "Admin officer",
    role: "Age 28",
    quote: "I finally knew which skills to grow, instead of sitting with the anxiety.",
  },
  {
    avatar: "H",
    name: "HR manager",
    role: "Age 35",
    quote: "The report helped me walk into a promotion conversation with a plan.",
  },
  {
    avatar: "D",
    name: "Designer",
    role: "Age 31",
    quote: "Seeing an opportunity list, not a threat list, changed how I looked at AI.",
  },
];

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Start free analysis" },
      { label: "Work profile (E1)" },
      { label: "AI exposure (E2)" },
      { label: "Skills (E3)" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Evidence sources" },
      { label: "Task priorities" },
      { label: "Future iterations" },
      { label: "Project methodology" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "How it works" },
      { label: "Sample report" },
      { label: "Read your results" },
      { label: "Review task evidence" },
    ],
  },
  {
    title: "Evidence",
    links: [
      { href: "/system-design", label: "System design" },
      { label: "IMF Malaysia Article IV (2025)" },
      { label: "ILO Working Paper 140" },
      { label: "ISIS Malaysia + World Bank" },
      { label: "SDG 5.b alignment" },
    ],
  },
];

export const FOOTER_CONTACT = {
  projectName: "AI-Wrevolusi",
  teamName: "United6",
  teamMeta: "FIT5120 Team 11",
  note: "Designed for working women in Malaysia navigating AI-driven task change.",
};

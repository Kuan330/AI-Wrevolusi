export interface HomeNavLink {
  href: string;
  label: string;
}

export interface StepItem {
  title: string;
  description: string;
  callout: string;
  source: string;
  icon: string;
}

export interface TestimonialItem {
  avatar: string;
  name: string;
  role: string;
  quote: string;
}

export interface FooterLinkItem {
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
    title: "Record your real work, and get a profile that fits you.",
    description:
      "Start with what you actually do. Choose the closest occupation, then adjust the tasks to match your working day.",
    callout: "An honest picture of your work is the starting point for every next step.",
    source: "Built on MASCO · Malaysia's official occupation classification",
    icon: "/images/icons/icon-work-profile.svg",
  },
  {
    title: "Check your tasks against AI, and see where it helps or changes.",
    description:
      "Review each confirmed task with ILO evidence to see where AI may assist, reshape or leave the work human-led.",
    callout: "Task-level evidence, not a prediction that your job will disappear.",
    source: "ILO Working Paper 140 · Generative AI and jobs",
    icon: "/images/icons/icon-ai-exposure.svg",
  },
  {
    title: "Uncover the skills already in your work, and see how their value may change.",
    description:
      "Connect your tasks to WEF skills and see which strengths are growing, stable or changing.",
    callout: "Your daily work already contains evidence of valuable skills.",
    source: "WEF Future of Jobs Report 2025",
    icon: "/images/icons/icon-skills.svg",
  },
  {
    title: "Explore where those skills could take you, without starting from zero.",
    description:
      "Find related occupations where your current strengths can transfer and open new options.",
    callout: "Your skills can create more possibilities across kinds of work.",
    source: "Explore related occupations from your strengths",
    icon: "/images/icons/icon-occupations.svg",
  },
  {
    title: "Turn your choices into a learning plan that fits your real life.",
    description:
      "Build practical next steps around your time, responsibilities and career stage.",
    callout: "A useful plan has to fit the life you actually have.",
    source: "Time, schedule and responsibilities are part of the plan",
    icon: "/images/icons/icon-learning-plan.svg",
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

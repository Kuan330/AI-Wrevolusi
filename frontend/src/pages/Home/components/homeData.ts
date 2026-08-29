export interface HomeNavLink {
  href: string;
  label: string;
}

export interface StepItem {
  title: string;
  description: string;
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

export const NAV_LINKS: HomeNavLink[] = [
  { href: "#steps", label: "How it works" },
  { href: "#report", label: "Sample report" },
];

export const TRUST_ITEMS = [
  "No CV upload",
  "Not used to train models",
  "Based on your actual tasks",
];

export const STEPS: StepItem[] = [
  {
    title: "Which tasks are changing?",
    description:
      "Separate AI-assisted work, tasks that may be redesigned, and work that still needs you.",
  },
  {
    title: "What makes you more valuable?",
    description:
      "Surface judgement, communication, creativity, and domain experience you already use.",
  },
  {
    title: "What should you do next?",
    description:
      "Get a 90-day learning and action path that fits your time and career stage.",
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
      { label: "Capabilities (E3)" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Interpretation (E4)" },
      { label: "Priorities (E6)" },
      { label: "Preparation (E7)" },
      { label: "Task efficiency" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "How it works" },
      { label: "Sample report" },
      { label: "Flexibility plan (E8)" },
      { label: "Dashboard" },
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

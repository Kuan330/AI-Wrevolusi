import { courses } from "./catalogue";
import { accountStorage } from "@/services/accountStorage";
import type { LearningCentreItem } from "@/pages/Skills/skillDirections";

export type Resource = {
  id: string;
  title: string;
  provider: string;
  url: string;
  summary: string;
  minutes?: number;
  format: "Module" | "Course";
  tags: string[];
  access: string;
};
// Curated source links checked on 2026-09-07. This is not a live API catalogue.
export const resources: Resource[] = [
  {
    id: "ms-generative-basics",
    title: "Introduction to generative AI — Exploring the basics",
    provider: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/training/modules/intro-generative-ai-explore-basics/",
    summary:
      "Explore generative AI and reflect on the critical thinking skills you bring to working with it.",
    format: "Module",
    tags: [
      "ai",
      "artificial intelligence",
      "technological",
      "digital",
      "critical",
      "analytical",
      "thinking",
      "技术",
      "分析",
      "批判",
    ],
    access:
      "Read on Microsoft Learn. Sign-in may be needed to record progress; tool exercises may have separate requirements.",
  },
  {
    id: "ou-thinking",
    title: "Extending and developing your thinking skills",
    provider: "OpenLearn",
    url: "https://www.open.edu/openlearn/education-development/extending-and-developing-your-thinking-skills/content-section-0",
    summary:
      "Explore approaches to thinking, including analysis, argument and critical thinking.",
    format: "Course",
    tags: [
      "analytical",
      "critical",
      "thinking",
      "creative",
      "problem",
      "curiosity",
      "lifelong",
      "分析",
      "思维",
      "创造",
      "学习",
    ],
    access:
      "Free course content on OpenLearn. An account is needed for participation records and some activities.",
  },
  {
    id: "ou-communication",
    title: "Effective communication in the workplace",
    provider: "OpenLearn",
    url: "https://www.open.edu/openlearn/money-business/effective-communication-the-workplace/content-section-0",
    summary:
      "Explore workplace communication and reflect on how you communicate with other people.",
    format: "Course",
    tags: [
      "communication",
      "listening",
      "empathy",
      "leadership",
      "social",
      "team",
      "customer",
      "沟通",
      "倾听",
      "领导",
      "团队",
    ],
    access:
      "Free course content on OpenLearn. Sign in for a participation record and eligible badge activities.",
  },
];
export function matches(resource: Resource, theme: LearningCentreItem) {
  const text =
    `${theme.title} ${theme.description} ${theme.skill_name}`.toLowerCase();
  return resource.tags.some((tag) =>
    /^[a-z]+$/.test(tag)
      ? new RegExp(`\\b${tag}\\b`, "i").test(text)
      : text.includes(tag),
  );
}
// Keep the existing planner resource contract and previously saved resource IDs.
resources.push(
  ...courses.map((course) => ({
    id: `epic5-${course.id}`,
    title: course.title,
    provider: course.provider,
    url: course.url,
    summary: course.intro,
    minutes: course.durationMin ?? undefined,
    format: "Course" as const,
    tags: course.skills,
    access:
      course.register === "required"
        ? "Free registration required"
        : "No registration required",
  })),
);
export type Selection = {
  resourceId: string;
  themeTitle: string;
  skillName: string;
  addedAt: string;
  chapterNames?: string[];
  weekdays?: number[];
  minutesPerDay?: number;
  startDate?: string;
  scheduleMode?: "later" | "routine";
};
const KEY = "aiwrevolusi.learningResourceSelections.v1";
export function readSelections(): Selection[] {
  try {
    const value: unknown = JSON.parse(accountStorage.getItem(KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is Selection =>
          !!item &&
          typeof item === "object" &&
          typeof item.resourceId === "string" &&
          resources.some((r) => r.id === item.resourceId) &&
          typeof item.themeTitle === "string" &&
          typeof item.skillName === "string" &&
          typeof item.addedAt === "string",
      )
      .filter(
        (item, index, all) =>
          all.findIndex((other) => other.resourceId === item.resourceId) ===
          index,
      );
  } catch {
    return [];
  }
}
export function saveSelections(items: Selection[]) {
  accountStorage.setItem(KEY, JSON.stringify(items));
}

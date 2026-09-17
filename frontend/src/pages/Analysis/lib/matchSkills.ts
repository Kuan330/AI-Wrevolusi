import type { WefSkill } from "@/types/reference";

/**
 * Keep in sync with backend `app.services.skill_matching.SKILL_RULES`.
 * AI Impact "Reflected in your tasks" and Possibilities profile skills both
 * flow through this matcher via `buildSkillEvidence`.
 */
const SKILL_RULES: { skillId: number; phrases: string[]; confidence: number }[] =
  [
    {
      skillId: 1,
      phrases: [
        "analytical",
        "analytical thinking",
        "thinking",
        "analyse",
        "analyze",
        "analysis",
        "problem solving",
        "reasoning",
      ],
      confidence: 0.88,
    },
    {
      skillId: 2,
      phrases: [
        "resilience",
        "resilient",
        "flexibility",
        "agility",
        "adapt to change",
        "working under pressure",
        "cope with change",
      ],
      confidence: 0.84,
    },
    {
      skillId: 3,
      phrases: [
        "leadership",
        "leading a team",
        "lead a team",
        "managing a team",
        "supervising staff",
        "assigning staff",
        "work schedules",
        "delegating",
      ],
      confidence: 0.88,
    },
    {
      skillId: 4,
      phrases: [
        "creative",
        "creative thinking",
        "creativity",
        "thinking",
        "innovation",
        "brainstorming",
        "new ideas",
      ],
      confidence: 0.86,
    },
    {
      skillId: 5,
      phrases: [
        "motivation",
        "self-motivated",
        "self-awareness",
        "take initiative",
        "working independently",
        "reflect on",
      ],
      confidence: 0.8,
    },
    {
      skillId: 6,
      phrases: [
        "technological literacy",
        "technological",
        "literacy",
        "digital tools",
        "software",
        "spreadsheets",
        "excel",
        "computer skills",
      ],
      confidence: 0.86,
    },
    {
      skillId: 7,
      phrases: [
        "empathy",
        "empathetic",
        "active listening",
        "listening",
        "understand customer",
        "compassion",
      ],
      confidence: 0.86,
    },
    {
      skillId: 8,
      phrases: [
        "curiosity",
        "curious",
        "lifelong learning",
        "continuous learning",
        "upskilling",
        "self-development",
      ],
      confidence: 0.82,
    },
    {
      skillId: 9,
      phrases: [
        "talent management",
        "talent",
        "hiring",
        "recruiting",
        "interviewing staff",
        "evaluating staff",
        "promoting staff",
        "onboarding",
      ],
      confidence: 0.88,
    },
    {
      skillId: 10,
      phrases: [
        "customer service",
        "prompt service",
        "advising",
        "customer",
        "client",
        "complaint",
        "after-sales",
      ],
      confidence: 0.9,
    },
    {
      skillId: 11,
      phrases: [
        "artificial intelligence",
        "generative ai",
        "machine learning",
        "big data",
        "data analytics",
        "data science",
        "ai",
      ],
      confidence: 0.88,
    },
    {
      skillId: 12,
      phrases: [
        "systems thinking",
        "systems",
        "thinking",
        "root cause",
        "recurring causes",
        "interconnected",
      ],
      confidence: 0.82,
    },
    {
      skillId: 13,
      phrases: [
        "resource management",
        "operations",
        "inventory",
        "stock levels",
        "ordering new stock",
        "supplier",
        "procurement",
        "logistics",
      ],
      confidence: 0.86,
    },
    {
      skillId: 14,
      phrases: [
        "dependability",
        "attention to detail",
        "dependable",
        "reliability",
        "accuracy",
        "checking work",
        "thoroughness",
      ],
      confidence: 0.84,
    },
    {
      skillId: 15,
      phrases: [
        "quality control",
        "quality",
        "quality assurance",
        "quality checks",
        "inspection",
        "audit",
        "compliance",
        "safety",
      ],
      confidence: 0.86,
    },
    {
      skillId: 16,
      phrases: [
        "teaching",
        "teach",
        "mentor",
        "mentoring",
        "coach",
        "coaching",
        "training",
        "instructing staff",
      ],
      confidence: 0.88,
    },
    {
      skillId: 17,
      phrases: [
        "cybersecurity",
        "network security",
        "it security",
        "firewall",
        "data protection",
        "networks",
      ],
      confidence: 0.86,
    },
    {
      skillId: 18,
      phrases: [
        "design",
        "user experience",
        "usability",
        "prototyping",
        "wireframe",
        "user research",
        "displaying goods",
      ],
      confidence: 0.82,
    },
    {
      skillId: 19,
      phrases: [
        "multi-lingualism",
        "multilingual",
        "language",
        "bilingual",
        "translating",
      ],
      confidence: 0.84,
    },
    {
      skillId: 20,
      phrases: [
        "marketing",
        "media",
        "campaigns",
        "social media",
        "advertising",
        "brand",
        "content creation",
      ],
      confidence: 0.86,
    },
    {
      skillId: 21,
      phrases: [
        "reading",
        "writing",
        "report writing",
        "documentation",
        "mathematics",
        "numeracy",
        "calculations",
        "budget",
        "financial transactions",
        "invoice",
        "payment",
        "records",
      ],
      confidence: 0.8,
    },
    {
      skillId: 22,
      phrases: [
        "environmental",
        "environmental stewardship",
        "stewardship",
        "sustainability",
        "sustainable",
        "carbon footprint",
        "recycling",
        "esg",
      ],
      confidence: 0.86,
    },
    {
      skillId: 23,
      phrases: [
        "programming",
        "coding",
        "software development",
        "python",
        "javascript",
        "sql",
        "writing code",
        "computer code",
      ],
      confidence: 0.88,
    },
    {
      skillId: 24,
      phrases: [
        "manual dexterity",
        "manual",
        "dexterity",
        "precision",
        "hand tools",
        "assembling",
        "stacking",
        "packing",
      ],
      confidence: 0.8,
    },
    {
      skillId: 25,
      phrases: [
        "global citizenship",
        "citizenship",
        "diversity",
        "inclusion",
        "cross-cultural",
      ],
      confidence: 0.8,
    },
    {
      skillId: 26,
      phrases: [
        "sensory",
        "sensory-processing",
        "colour detection",
        "colour matching",
      ],
      confidence: 0.78,
    },
  ];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const phrasePattern = (phrase: string) =>
  new RegExp(`\\b${escapeRegExp(phrase)}(?:s|es)?\\b`, "i");

const COMPILED_RULES = SKILL_RULES.map((rule) => ({
  ...rule,
  patterns: rule.phrases.map(phrasePattern),
}));

/** Default matches the backend task-suggestion cap. */
export const MAX_SKILL_MATCHES = 3;

export const skillsForTask = (
  taskText: string,
  skills: WefSkill[],
  limit: number | null = MAX_SKILL_MATCHES,
): WefSkill[] => {
  if (!taskText.trim()) return [];

  const byId = new Map(skills.map((skill) => [skill.wef_skill_id, skill]));
  const matches: { skillId: number; confidence: number }[] = [];

  for (const rule of COMPILED_RULES) {
    if (!byId.has(rule.skillId)) continue;
    if (!rule.patterns.some((pattern) => pattern.test(taskText))) continue;
    matches.push({ skillId: rule.skillId, confidence: rule.confidence });
  }

  matches.sort((left, right) => right.confidence - left.confidence);
  const selected =
    limit == null ? matches : matches.slice(0, Math.max(0, limit));

  return selected
    .map(({ skillId }) => byId.get(skillId))
    .filter((skill): skill is WefSkill => Boolean(skill));
};

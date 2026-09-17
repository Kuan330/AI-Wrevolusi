import { skillKey } from "@/pages/Skills/learningSkills";
import type { WefSkill } from "@/types/reference";

/**
 * How the two WEF signals are weighted: current employer demand counts for 40%,
 * the expected 2025→2030 change counts for 60%. The bias towards growth keeps
 * skills like "AI and big data" (45% today, +87 ahead) from being held back by
 * today's numbers alone.
 */
const IMPORTANCE_WEIGHT = 0.4;
const GROWTH_WEIGHT = 0.6;
/** Upper bound of each star band, brightest first. */
const STAR_BANDS = [0.2, 0.4, 0.6, 0.8];

export type SkillRating = {
  /** 1 (lowest) to 5 (highest). */
  stars: number;
  /** Position in the weighted ranking, 1 = strongest. */
  rank: number;
  importance: number;
  growth: number;
};

/**
 * Rate every WEF core skill from 1 to 5 stars.
 *
 * Both signals are normalised across the skills passed in, weighted, then cut
 * into five evenly populated bands by rank. Raw scores are far too skewed for
 * fixed thresholds — with 26 skills a single band would swallow eight of them.
 * The trade-off is that a star is a *relative* standing within the catalogue
 * rather than an absolute score, so it shifts if the reference data changes.
 */
export function rateWefSkills(skills: WefSkill[]): Map<string, SkillRating> {
  const rateable = skills.flatMap((skill) => {
    const importance = skill.core_skill_importance_2025_pct;
    const growth = skill.future_net_increase_2025_2030;
    return typeof importance === "number" && typeof growth === "number"
      ? [{ id: skillKey(skill.core_skill), importance, growth }]
      : [];
  });
  if (!rateable.length) return new Map();

  const importanceRange = rangeOf(rateable.map((item) => item.importance));
  const growthRange = rangeOf(rateable.map((item) => item.growth));
  const scored = rateable
    .map((item) => ({
      ...item,
      score:
        IMPORTANCE_WEIGHT * normalise(item.importance, importanceRange) +
        GROWTH_WEIGHT * normalise(item.growth, growthRange),
    }))
    .sort((left, right) => right.score - left.score);

  return new Map(
    scored.map((item, index) => [
      item.id,
      {
        stars: starsForPercentile((index + 0.5) / scored.length),
        rank: index + 1,
        importance: item.importance,
        growth: item.growth,
      },
    ]),
  );
}

function rangeOf(values: number[]) {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalise(value: number, { min, max }: { min: number; max: number }) {
  return max === min ? 0.5 : (value - min) / (max - min);
}

function starsForPercentile(percentile: number) {
  const band = STAR_BANDS.findIndex((limit) => percentile < limit);
  return band === -1 ? 1 : STAR_BANDS.length + 1 - band;
}

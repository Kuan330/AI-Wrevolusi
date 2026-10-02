import type { WefSkill } from "../../types/reference.ts";
import type { Course } from "./types.ts";

export type CatalogueSkill = { id: number; slug: string; name: string };

/** Same stable name slug used by the WEF catalogue endpoint and skill-path links. */
export function catalogueSkillSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function validateCatalogueSkillSlug(value: string): string {
  const slug = value.trim();
  if (!slug || /^\d+$/.test(slug) || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Choose a supported catalogue skill before looking up courses.");
  }
  return slug;
}

/** Numeric WEF IDs must be resolved through reference data, not passed as API slugs. */
export function resolveCatalogueSkill(value: string | number | null | undefined, skills: WefSkill[]): CatalogueSkill | null {
  if (value === null || value === undefined || !String(value).trim()) return null;
  const raw = String(value).trim();
  if (raw.length > 300) return null;
  const row = /^\d+$/.test(raw)
    ? skills.find(skill => skill.wef_skill_id === Number(raw))
    : skills.find(skill => catalogueSkillSlug(skill.core_skill) === catalogueSkillSlug(raw));
  if (!row || !Number.isSafeInteger(row.wef_skill_id) || row.wef_skill_id <= 0) return null;
  const slug = catalogueSkillSlug(row.core_skill);
  try { validateCatalogueSkillSlug(slug); } catch { return null; }
  return { id: row.wef_skill_id, slug, name: row.core_skill };
}

/** Filter before deduplication so a shared provider URL retains the correct skill mapping. */
export function coursesForCatalogueSkill(courses: Course[], skill: string): Course[] {
  const slug = validateCatalogueSkillSlug(skill);
  return courses.filter(course => course.skills.includes(slug));
}

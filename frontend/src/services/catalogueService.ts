import { api } from "@/services/api";
import type { Course } from "@/pages/LearningCentre/types";

/** Verified catalogue endpoints return DB level names; the page uses slugs. */
const LEVEL_BY_API_VALUE: Record<string, string> = {
  Beginner: "beginner",
  Intermediate: "intermediate",
  Advanced: "advanced",
};

/** Shorter display names for long provider strings. */
const PROVIDER_DISPLAY: Record<string, string> = {
  "OpenLearn / The Open University": "OpenLearn",
};

type ApiChapter = {
  order: number;
  title: string;
  duration_min: number | null;
};

type ApiCourse = {
  course_id: string;
  skill_id: string;
  skill_name: string;
  title: string | null;
  provider: string | null;
  url: string | null;
  level: string | null;
  course_no: number | null;
  language: string | null;
  format: string | null;
  self_paced: boolean | null;
  duration_min: number | null;
  register: string | null;
  description: string | null;
  outcomes: string | null;
  prereq: string | null;
  advice: string | null;
  chapter_count: number;
  chapters: ApiChapter[];
};

type PageCatalogueResponse = {
  skill_id: string | null;
  skill_name: string | null;
  found: boolean;
  courses: ApiCourse[];
};

export type CatalogueFetchResult = {
  courses: Course[];
  notice?: string;
};

function mapCourse(item: ApiCourse): Course {
  const skillId = item.skill_id;
  const chapters =
    Array.isArray(item.chapters) && item.chapters.length > 0
      ? item.chapters.map((chapter) => ({
          title: chapter.title,
          min: chapter.duration_min ?? null,
        }))
      : null;
  return {
    id: item.course_id,
    title: item.title ?? "",
    provider: PROVIDER_DISPLAY[item.provider ?? ""] ?? (item.provider ?? ""),
    level: LEVEL_BY_API_VALUE[item.level ?? ""] ?? "unknown",
    language: item.language ?? "",
    format: item.format ?? "",
    selfPaced: Boolean(item.self_paced),
    durationMin: item.duration_min ?? null,
    register: item.register === "required" ? "required" : "not-required",
    url: item.url ?? "",
    skills: skillId ? [skillId] : [],
    match: skillId ? { [skillId]: item.advice ?? "" } : {},
    intro: item.description ?? "",
    outcomes: (item.outcomes ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean),
    prereq: item.prereq ?? "",
    chapters,
    advice: item.advice ?? "",
  };
}

/**
 * Load the page-shaped catalogue for one skill, or the whole catalogue when
 * ``skillId`` is null. The backend owns the catalogue, so a missing or
 * unreachable endpoint surfaces as an error for the caller to report rather
 * than falling back to bundled sample data.
 */
export async function fetchPageCatalogue(
  skillId: string | null,
): Promise<CatalogueFetchResult> {
  const query = skillId ? `?skill=${encodeURIComponent(skillId)}` : "";
  const data = await api.get<PageCatalogueResponse>(
    `/learning/courses${query}`,
  );
  if (data.found === false) {
    return {
      courses: [],
      notice: "This skill does not have verified courses yet.",
    };
  }
  return { courses: data.courses.map(mapCourse) };
}

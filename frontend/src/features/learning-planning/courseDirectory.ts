import { fetchPageCatalogue } from "../../services/catalogueService.ts";
import type { Course } from "./types";
import { coursesForCatalogueSkill, validateCatalogueSkillSlug } from "./catalogueSkill.ts";
import type { CatalogueFetchResult } from "../../services/catalogueService.ts";

/**
 * The backend owns the course catalogue, so anything that keeps a bare course id
 * (the learning list, saved-course counts, the plan) has to resolve it against
 * the live catalogue. Bundled sample courses used to stand in for this and their
 * ids never matched the backend ones, which silently dropped saved courses.
 */
let directory: Promise<Map<string, Course>> | null = null;
let lastLoaded: Map<string, Course> | null = null;
let loadedAt = 0;
const MAX_AGE_MS = 60_000;
const skillRequests = new Map<string, { at: number; request: Promise<CatalogueFetchResult> }>();

export function loadCourseDirectory(refresh = false): Promise<Map<string, Course>> {
  if (!directory || refresh || Date.now() - loadedAt > MAX_AGE_MS) {
    loadedAt = Date.now();
    const request = fetchPageCatalogue(null)
      .then((result) => {
        lastLoaded = new Map(result.courses.map((course) => [course.id, course]));
        return lastLoaded;
      })
      .catch((error: unknown) => {
        // Let a later call retry instead of caching the failure forever.
        if (directory === request) directory = null;
        throw error;
      });
    directory = request;
  }
  return directory;
}

/** The last loaded catalogue, any age, so a page can show it while a refresh runs. */
export function cachedCourseDirectory() {
  return lastLoaded;
}

/** Drop the cached catalogue, e.g. after the backend data changes. */
export function resetCourseDirectory() {
  directory = null;
  lastLoaded = null;
  skillRequests.clear();
}

/** Pages and save operations resolve courses from the same bounded snapshot. */
export async function loadLearningCatalogue(skillId: string | null, refresh = false): Promise<CatalogueFetchResult> {
  if (skillId === null) {
    const directory = await loadCourseDirectory(refresh);
    const courses = [...directory.values()];
    return { courses, notice: courses.length ? "" : "The verified course catalogue is empty." };
  }
  const slug = validateCatalogueSkillSlug(skillId);
  const cached = skillRequests.get(slug);
  if (cached && !refresh && Date.now() - cached.at < MAX_AGE_MS) return cached.request;
  const request = fetchPageCatalogue(slug).then(result => {
    const courses = coursesForCatalogueSkill(result.courses, slug);
    return { courses, notice: courses.length ? result.notice ?? "" : result.notice || "This skill does not have verified courses yet." };
  }).catch((error: unknown) => {
    if (skillRequests.get(slug)?.request === request) skillRequests.delete(slug);
    throw error;
  });
  skillRequests.set(slug, { at: Date.now(), request });
  return request;
}

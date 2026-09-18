import { fetchPageCatalogue } from "../../services/catalogueService.ts";
import type { Course } from "./types";

/**
 * The backend owns the course catalogue, so anything that keeps a bare course id
 * (the learning list, saved-course counts, the plan) has to resolve it against
 * the live catalogue. Bundled sample courses used to stand in for this and their
 * ids never matched the backend ones, which silently dropped saved courses.
 */
let directory: Promise<Map<string, Course>> | null = null;
let loadedAt = 0;
const MAX_AGE_MS = 60_000;

export function loadCourseDirectory(refresh = false): Promise<Map<string, Course>> {
  if (!directory || refresh || Date.now() - loadedAt > MAX_AGE_MS) {
    loadedAt = Date.now();
    const request = fetchPageCatalogue(null)
      .then(
        (result) =>
          new Map(result.courses.map((course) => [course.id, course])),
      )
      .catch((error: unknown) => {
        // Let a later call retry instead of caching the failure forever.
        if (directory === request) directory = null;
        throw error;
      });
    directory = request;
  }
  return directory;
}

/** Drop the cached catalogue, e.g. after the backend data changes. */
export function resetCourseDirectory() {
  directory = null;
}

/** Pages and save operations resolve courses from the same bounded snapshot. */
export async function loadLearningCatalogue(skillId: string | null, refresh = false) {
  const directory = await loadCourseDirectory(refresh);
  const courses = [...directory.values()].filter(course => !skillId || course.skills.includes(skillId));
  return { courses, notice: courses.length ? "" : "This skill does not have verified courses yet." };
}

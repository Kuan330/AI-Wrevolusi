import { fetchPageCatalogue } from "@/services/catalogueService";
import type { Course } from "../types";

/**
 * The backend owns the course catalogue, so anything that keeps a bare course id
 * (the learning list, saved-course counts, the plan) has to resolve it against
 * the live catalogue. Bundled sample courses used to stand in for this and their
 * ids never matched the backend ones, which silently dropped saved courses.
 */
let directory: Promise<Map<string, Course>> | null = null;

export function loadCourseDirectory(): Promise<Map<string, Course>> {
  if (!directory) {
    directory = fetchPageCatalogue(null)
      .then(
        (result) =>
          new Map(result.courses.map((course) => [course.id, course])),
      )
      .catch((error: unknown) => {
        // Let a later call retry instead of caching the failure forever.
        directory = null;
        throw error;
      });
  }
  return directory;
}

/** Drop the cached catalogue, e.g. after the backend data changes. */
export function resetCourseDirectory() {
  directory = null;
}

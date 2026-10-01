import type { Course } from "./types";

export type CourseGroup = { course: Course; mappings: Course[] };

/** Remove display-only URL differences while keeping provider course IDs. */
export function canonicalCourseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(?:fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

/** A display group only: raw catalogue IDs and saved learning records stay intact. */
export function groupProviderCourses(courses: Course[]): CourseGroup[] {
  const groups = new Map<string, CourseGroup>();
  for (const course of courses) {
    const key = canonicalCourseUrl(course.url) ?? `catalogue:${course.id}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { course: { ...course, skills: [...course.skills], match: { ...course.match } }, mappings: [course] });
    } else {
      group.mappings.push(course);
      group.course.skills = [...new Set([...group.course.skills, ...course.skills])];
      group.course.match = { ...group.course.match, ...course.match };
    }
  }
  return [...groups.values()];
}

/** Use an existing saved record when a grouped course is reopened. */
export function courseGroupRecord(group: CourseGroup, savedIds: readonly string[], preferredId?: string): Course {
  return group.mappings.find(course => savedIds.includes(course.id))
    ?? group.mappings.find(course => course.id === preferredId)
    ?? group.mappings[0];
}

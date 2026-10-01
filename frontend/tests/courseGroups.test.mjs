import test from "node:test";
import assert from "node:assert/strict";
import { canonicalCourseUrl, groupProviderCourses, courseGroupRecord } from "../src/features/learning-planning/courseGroups.ts";

const course = (id, url, skill) => ({ id, title: "Learn to learn", provider: "OpenLearn", url, skills: [skill], match: { [skill]: `For ${skill}` } });

test("groups one provider URL with all linked skills without changing catalogue records", () => {
  const courses = [course("skill-a-course", "https://provider.example/course/learn/", "skill-a"), course("skill-b-course", "https://provider.example/course/learn?utm_source=search#overview", "skill-b")];
  const before = structuredClone(courses);
  const groups = groupProviderCourses(courses);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].course.skills, ["skill-a", "skill-b"]);
  assert.deepEqual(groups[0].course.match, { "skill-a": "For skill-a", "skill-b": "For skill-b" });
  assert.deepEqual(groups[0].mappings.map(item => item.id), ["skill-a-course", "skill-b-course"]);
  assert.deepEqual(courses, before);
});

test("keeps distinct provider course IDs and unusable URLs separate", () => {
  const courses = [course("a", "https://provider.example/course?id=1", "one"), course("b", "https://provider.example/course?id=2", "two"), course("c", "", "three"), course("d", "", "four")];
  assert.equal(groupProviderCourses(courses).length, 4);
  assert.equal(canonicalCourseUrl("javascript:alert(1)"), null);
  assert.equal(canonicalCourseUrl("not a url"), null);
});

test("normalises query order and tracking without removing meaningful queries", () => {
  assert.equal(canonicalCourseUrl("https://Provider.Example/course/?b=2&gclid=tracking&a=1#intro"), "https://provider.example/course?a=1&b=2");
  assert.notEqual(canonicalCourseUrl("https://provider.example/course?id=1"), canonicalCourseUrl("https://provider.example/course?id=2"));
});

test("reopens the existing saved skill record while preserving all histories", () => {
  const a = course("skill-a-course", "https://provider.example/course", "skill-a");
  const b = course("skill-b-course", "https://provider.example/course", "skill-b");
  const [group] = groupProviderCourses([a, b]);
  const saved = ["skill-b-course"];
  assert.equal(courseGroupRecord(group, saved), b);
  assert.equal(courseGroupRecord(group, []), a);
  assert.equal(courseGroupRecord(group, [], b.id), b);
  assert.equal(courseGroupRecord(group, saved, a.id), b);
  assert.deepEqual(saved, ["skill-b-course"]);
  assert.deepEqual(group.mappings, [a, b]);
});

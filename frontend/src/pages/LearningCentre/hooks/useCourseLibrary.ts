import { toast } from "sonner";
import { accountStorage } from "@/services/accountStorage";
import { useState } from "react";
import { courses, focusSkills } from "../catalogue";
import { readLibrary, saveLibrary, emptyLibrary } from "../lib/libraryStorage";
import {
  defaultChoice,
  validateChoice,
  durationLabel,
  estimateLabel,
} from "../lib/coursePlanning";
import { readSelections, saveSelections } from "../resources";
import type { Course, CourseChoice, LibraryState } from "../types";
export function useCourseLibrary() {
  const [initial] = useState(() => {
    try {
      return { state: readLibrary(), error: "" };
    } catch (error) {
      return {
        state: emptyLibrary(),
        error:
          error instanceof Error
            ? error.message
            : "Could not load saved courses.",
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const [notice, setNotice] = useState(initial.error);
  function update(next: LibraryState) {
    if (initial.error) {
      setNotice(initial.error);
      return false;
    }
    try {
      saveLibrary(next);
      setState(next);
      return true;
    } catch {
      setNotice("Could not save your changes. Please try again.");
      return false;
    }
  }
  function choiceFor(course: Course) {
    return state.choices[course.id] ?? defaultChoice(course);
  }
  function toggleSave(courseId: string) {
    const wasSaved = state.saved.includes(courseId);
    const changed = update({
      ...state,
      saved: state.saved.includes(courseId)
        ? state.saved.filter((id) => id !== courseId)
        : [...state.saved, courseId],
    });
    if (changed)
      toast(
        wasSaved
          ? "Removed from saved courses. Your plan is unchanged."
          : "Saved to your courses",
        {
          action: {
            label: "Undo",
            onClick: () => {
              try {
                const latest = readLibrary();
                update({
                  ...latest,
                  saved: wasSaved
                    ? [...new Set([...latest.saved, courseId])]
                    : latest.saved.filter((id) => id !== courseId),
                });
              } catch {
                setNotice("Could not undo. Please try again.");
              }
            },
          },
        },
      );
  }
  function addToPlan(
    ids: string[],
    override?: { courseId: string; choice: CourseChoice },
  ): boolean {
    if (initial.error) return false;
    const items = courses.filter((course) => ids.includes(course.id));
    if (!items.length) {
      setNotice("Save or select a course first.");
      return false;
    }
    const selectedChoice = (course: Course) =>
      override?.courseId === course.id ? override.choice : choiceFor(course);
    for (const course of items) {
      const error = validateChoice(course, selectedChoice(course));
      if (error) {
        setNotice(`${course.title}: ${error}`);
        return false;
      }
    }
    const pending = new Map(
      state.pending.map((entry) => [entry.courseId, entry]),
    );
    const selections = new Map(
      readSelections().map((entry) => [entry.resourceId, entry]),
    );
    items.forEach((course) => {
      const choice = selectedChoice(course);
      const addedAt = new Date().toISOString();
      pending.set(course.id, {
        courseId: course.id,
        choice: structuredClone(choice),
        addedAt,
      });
      selections.set(`epic5-${course.id}`, {
        resourceId: `epic5-${course.id}`,
        themeTitle: course.title,
        skillName:
          focusSkills.find((skill) => skill.id === state.skillId)?.en ??
          "Learning",
        addedAt,
        chapterNames: course.chapters
          ?.filter((_, index) => choice.chapters.includes(index))
          .map((chapter) => chapter.title),
        weekdays: choice.weekdays,
        minutesPerDay: choice.minutesPerDay,
        scheduleMode: choice.scheduleMode,
        startDate:
          choice.scheduleMode === "routine" ? choice.startDate : undefined,
      });
    });
    try {
      saveSelections([...selections.values()]);
      if (
        update({
          ...state,
          pending: [...pending.values()],
          choices: override
            ? { ...state.choices, [override.courseId]: override.choice }
            : state.choices,
          saved: [...new Set([...state.saved, ...ids])],
        })
      ) {
        setNotice(
          `${items.length} course(s) added or updated. Confirm dates in My Plan.`,
        );
        return true;
      }
      return false;
    } catch {
      setNotice("Could not add courses to Plan. Please try again.");
      return false;
    }
  }
  function exportSaved(ids: string[]) {
    const lines = [
      "# My learning courses",
      "",
      ...courses
        .filter((course) => ids.includes(course.id))
        .flatMap((course) => {
          const choice = choiceFor(course);
          return [
            `## ${course.title}`,
            course.url,
            `Course duration: ${durationLabel(course.durationMin)}`,
            `Selected chapters: ${
              course.chapters
                ? course.chapters
                    .filter((_, index) => choice.chapters.includes(index))
                    .map((chapter) => chapter.title)
                    .join("; ") || "None"
                : "Whole course"
            }`,
            estimateLabel(course, choice),
            "",
          ];
        }),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-learning-courses.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let scheduledIds: string[] = [];
  try {
    const planner = JSON.parse(
      accountStorage.getItem("aiwrevolusi.planner.v1") ?? "{}",
    );
    scheduledIds = Array.isArray(planner.events)
      ? planner.events.flatMap((event: { resourceId?: string }) =>
          event.resourceId?.startsWith("epic5-")
            ? [event.resourceId.slice(6)]
            : [],
        )
      : [];
  } catch {
    /* Scheduling remains owned by My Plan. */
  }
  return {
    scheduledIds,
    state,
    update,
    notice,
    choiceFor,
    toggleSave,
    addToPlan,
    exportSaved,
  };
}

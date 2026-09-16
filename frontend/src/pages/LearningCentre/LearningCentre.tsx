import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { useSearchParams } from "react-router-dom";
import SkillSidebar from "./components/SkillSidebar";
import CourseFilters, { emptyFilters } from "./components/CourseFilters";
import CourseCard from "./components/CourseCard";
import CourseDetailDrawer from "./components/CourseDetailDrawer";
import FloatingLearningCourses from "./components/FloatingLearningCourses";
import LearningCoursesDialog from "./components/LearningCoursesDialog";
import AddSkillDialog from "./components/AddSkillDialog";
import RemoveSkillDialog from "./components/RemoveSkillDialog";
import { courses } from "./catalogue";
import { useCourseLibrary } from "./hooks/useCourseLibrary";
import {
  coursesForSkill,
  ensureLearningSkills,
  toLearningSkill,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { useLearningSkills } from "@/pages/Skills/useLearningSkills";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import "./course-library.css";

export default function LearningCentre() {
  const library = useCourseLibrary();
  const { state, notice, toggleSave, removeSavedCourses } = library;
  const { skills, setSkills, addSkill, removeSkill, refresh } =
    useLearningSkills();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({
    ...emptyFilters,
    query: params.get("q") ?? "",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [skillsError, setSkillsError] = useState("");
  const [analysis] = useState(readConfirmedAnalysis);
  const [seeded, setSeeded] = useState(false);
  /** Empty = show all courses (default). */
  const [activeId, setActiveId] = useState("");

  const workSkills = useMemo(() => {
    const evidence = buildSkillEvidence(analysis?.tasks ?? [], wefSkills);
    return evidence.map(({ skill }) =>
      toLearningSkill(skill.core_skill, "work"),
    );
  }, [analysis?.tasks, wefSkills]);

  useEffect(() => {
    let cancelled = false;
    void referenceService
      .wefSkills()
      .then((rows) => {
        if (cancelled) return;
        setWefSkills(
          [...rows].sort(
            (left, right) => left.wef_skill_id - right.wef_skill_id,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSkillsError(
            "The skill framework could not be loaded. Please try again.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!wefSkills.length || seeded) return;
    const next = ensureLearningSkills(workSkills);
    setSkills(next);
    setSeeded(true);
  }, [wefSkills.length, workSkills, seeded, setSkills]);

  const focusSkills = skills.map((item: LearningSkill) => ({
    id: item.id,
    en: item.name,
    hint: item.source === "work" ? "From your work" : undefined,
  }));

  useEffect(() => {
    if (!activeId) return;
    if (!focusSkills.some((item) => item.id === activeId)) {
      setActiveId("");
    }
  }, [focusSkills, activeId]);

  const skill = focusSkills.find((item) => item.id === activeId);
  const matching =
    !activeId || params.get("q")
      ? courses
      : courses.filter((course) =>
          coursesForSkill(activeId).includes(course.id),
        );
  const visible = matching.filter(
    (course) =>
      [course.title, course.provider, course.intro, ...course.outcomes]
        .join(" ")
        .toLowerCase()
        .includes(filters.query.trim().toLowerCase()) &&
      (!filters.level || course.level === filters.level) &&
      (!filters.provider || course.provider === filters.provider) &&
      (!filters.format || course.format === filters.format) &&
      (!filters.language || course.language === filters.language) &&
      (!filters.registration || course.register === filters.registration),
  );
  const detailCourse = courses.find((course) => course.id === detailId) ?? null;
  const addedIds = new Set(skills.map((item) => item.id));

  const confirmRemoveSkill = () => {
    if (!removeTarget) return;
    const linked = coursesForSkill(removeTarget.id);
    const remaining = skills.filter((item) => item.id !== removeTarget.id);
    // Keep a course if another remaining skill still links to it.
    const stillLinked = new Set(
      remaining.flatMap((item) => coursesForSkill(item.id)),
    );
    const dropCourses = linked.filter((id) => !stillLinked.has(id));
    removeSkill(removeTarget.id);
    if (dropCourses.length) {
      removeSavedCourses(dropCourses);
    }
    if (activeId === removeTarget.id) setActiveId("");
    setRemoveTarget(null);
  };

  const sidebarProps = {
    activeId,
    skills: focusSkills,
    onSelect: (skillId: string) => {
      setActiveId(skillId);
      setFilters({ ...emptyFilters });
    },
    onClear: () => setActiveId(""),
    onRemove: (id: string, name: string) => setRemoveTarget({ id, name }),
  };

  const filterProps = {
    value: filters,
    courses: matching,
    onChange: setFilters,
  };

  const headerProps = {
    title: "Learning Resources",
    actions: (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          className="learning-courses-trigger h-10 rounded-full px-5 font-semibold"
          onClick={() => setDrawerOpen(true)}
        >
          Learning courses · {state.saved.length}
        </Button>
      </div>
    ),
    description:
      "Browse courses for skills reflected in your work, or add skills you want to grow.",
  };

  return (
    <div className="course-library">
      <PageHeader {...headerProps} />
      {(skillsError || notice) && (
        <p role="alert">{skillsError || notice}</p>
      )}

      {!focusSkills.length ? (
        <section className="learning-empty-skills library-glass">
          <p className="library-kicker">Ready when you are</p>
          <h2>Add skills to explore courses</h2>
          <p>
            Skills reflected in your work will appear here automatically when
            available. You can also add skills from the WEF framework.
          </p>
          <AppButton tone="gradient" type="button" onClick={() => setAddOpen(true)}>
            Add skill
          </AppButton>
        </section>
      ) : (
        <div className="library-layout">
          <SkillSidebar {...sidebarProps} />
          <div
            className="library-results"
            role="region"
            aria-label="Course results"
            tabIndex={0}
          >
            <CourseFilters {...filterProps} />
            <p className="library-muted" role="status">
              {skill
                ? `${visible.length} of ${matching.length} courses for ${skill.en}`
                : `${visible.length} of ${matching.length} courses in the catalogue`}
            </p>
            <div className="library-course-list">
              <div className="library-course-list__col">
                {visible
                  .filter((_, index) => index % 2 === 0)
                  .map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      saved={state.saved.includes(course.id)}
                      onSave={() => toggleSave(course.id)}
                      onDetails={() => setDetailId(course.id)}
                    />
                  ))}
              </div>
              <div className="library-course-list__col">
                {visible
                  .filter((_, index) => index % 2 === 1)
                  .map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      saved={state.saved.includes(course.id)}
                      onSave={() => toggleSave(course.id)}
                      onDetails={() => setDetailId(course.id)}
                    />
                  ))}
              </div>
            </div>
            {!visible.length && (
              <div className="library-empty library-glass">
                <h3>
                  {matching.length
                    ? "No courses match these filters"
                    : "No matching courses yet"}
                </h3>
                <p>
                  {matching.length
                    ? "Try another format, provider or search term."
                    : "This skill stays in your learning list. The current catalogue has no linked courses yet."}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setFilters({ ...emptyFilters })}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {focusSkills.length > 0 && (
        <FloatingLearningCourses
          count={state.saved.length}
          onOpen={() => setDrawerOpen(true)}
        />
      )}

      <LearningCoursesDialog
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        saved={state.saved}
        onRemove={toggleSave}
      />

      {detailCourse && (
        <CourseDetailDrawer
          key={detailCourse.id}
          course={detailCourse}
          skillName={skill?.en ?? ""}
          saved={state.saved.includes(detailCourse.id)}
          onClose={() => setDetailId(null)}
          onSave={() => toggleSave(detailCourse.id)}
          onSkillsChanged={refresh}
        />
      )}

      <AddSkillDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) refresh();
        }}
        addedIds={addedIds}
        onAdd={(name, source) => addSkill(name, source)}
      />

      <RemoveSkillDialog
        open={Boolean(removeTarget)}
        skillName={removeTarget?.name ?? null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        onConfirm={confirmRemoveSkill}
      />
    </div>
  );
}

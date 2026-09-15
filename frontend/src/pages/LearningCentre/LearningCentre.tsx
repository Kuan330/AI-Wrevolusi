import { useEffect, useMemo, useState } from "react";
import { Bookmark, Gift } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import SkillSidebar from "./components/SkillSidebar";
import CourseFilters, { emptyFilters } from "./components/CourseFilters";
import RecommendationBasis from "./components/RecommendationBasis";
import CourseCard from "./components/CourseCard";
import CourseDetailDrawer from "./components/CourseDetailDrawer";
import FloatingSavedCourses from "./components/FloatingSavedCourses";
import SavedCoursesDrawer from "./components/SavedCoursesDrawer";
import LearningSkillPicker from "./components/LearningSkillPicker";
import { courses } from "./catalogue";
import { useCourseLibrary } from "./hooks/useCourseLibrary";
import {
  readLearningSkills,
  coursesForSkill,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import type { CourseChoice, RecommendationBasis as Basis } from "./types";
import "./course-library.css";

function loadFocusSkills(): LearningSkill[] {
  try {
    return readLearningSkills() ?? [];
  } catch {
    return [];
  }
}

export default function LearningCentre() {
  const library = useCourseLibrary();
  const {
    state,
    update,
    notice,
    choiceFor,
    toggleSave,
    addToPlan,
    exportSaved,
    scheduledIds,
  } = library;
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const [filters, setFilters] = useState({
    ...emptyFilters,
    query: params.get("q") ?? "",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<{
    id: string;
    planning: boolean;
  } | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [focusSkillsRaw, setFocusSkillsRaw] = useState(loadFocusSkills);
  const [editingSkills, setEditingSkills] = useState(
    () => hash === "#skill-directions" || loadFocusSkills().length === 0,
  );
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const detailCourse = courses.find((course) => course.id === detail?.id);
  const plannedIds = state.pending.map((entry) => entry.courseId);
  const focusSkills = focusSkillsRaw.map((item) => ({
    id: item.id,
    en: item.name,
    hint: "Selected for learning",
  }));
  const [activeId, setActiveId] = useState(focusSkills[0]?.id ?? "");
  const [analysis] = useState(readConfirmedAnalysis);
  const skill = focusSkills.find((item) => item.id === activeId);
  const matching = params.get("q")
    ? courses
    : skill
      ? courses.filter((course) => coursesForSkill(skill.id).includes(course.id))
      : [];
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
  const evidence = useMemo(
    () => buildSkillEvidence(analysis?.tasks ?? [], wefSkills),
    [analysis?.tasks, wefSkills],
  );

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
          setSelectionError(
            "The skill framework could not be loaded. Please try again.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hash !== "#skill-directions") return;
    setEditingSkills(true);
    const frame = requestAnimationFrame(() => {
      document
        .getElementById("skill-directions")
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  useEffect(() => {
    if (!focusSkills.length) return;
    if (!focusSkills.some((item) => item.id === activeId)) {
      setActiveId(focusSkills[0].id);
    }
  }, [focusSkills, activeId]);

  const refreshFocusSkills = () => {
    try {
      const next = loadFocusSkills();
      setFocusSkillsRaw(next);
      setSelectionError("");
      setActiveId(next[0]?.id ?? "");
      setEditingSkills(next.length === 0);
    } catch {
      setSelectionError(
        "Your learning skills could not be loaded. Please reload.",
      );
    }
  };

  const sidebarProps = {
    activeId,
    skills: focusSkills,
    onSelect: (skillId: string) => {
      setActiveId(skillId);
      setFilters({ ...emptyFilters });
    },
  };
  const filterProps = {
    value: filters,
    courses: matching,
    onChange: setFilters,
  };
  const basis: Basis = state.basis[activeId] ?? {
    tasks:
      analysis?.tasks
        .slice(0, 4)
        .map((task) => task.wording)
        .join("\n") ?? "",
    goals: "",
    have: "",
  };
  const basisProps = {
    skillName: skill?.en ?? "",
    value: basis,
    onSave: (value: Basis) =>
      update({ ...state, basis: { ...state.basis, [activeId]: value } }),
  };
  const drawerProps = {
    open: drawerOpen,
    onOpenChange: setDrawerOpen,
    saved: state.saved,
    onRemove: toggleSave,
    onPlan: (id: string) => {
      setDrawerOpen(false);
      setDetail({ id, planning: true });
    },
    onExport: exportSaved,
    plannedIds,
  };
  const detailProps = detailCourse
    ? {
        course: detailCourse,
        context: basis,
        skillName: skill?.en ?? "",
        choice:
          state.pending.find((entry) => entry.courseId === detailCourse.id)
            ?.choice ?? choiceFor(detailCourse),
        saved: state.saved.includes(detailCourse.id),
        inPlan: plannedIds.includes(detailCourse.id),
        scheduled: scheduledIds.includes(detailCourse.id),
        startPlanning: detail?.planning ?? false,
        onClose: () => setDetail(null),
        onSave: () => toggleSave(detailCourse.id),
        onCommit: (choice: CourseChoice) =>
          addToPlan([detailCourse.id], { courseId: detailCourse.id, choice }),
      }
    : null;
  const headerProps = {
    title: "Learning Resources",
    actions: (
      <div className="flex flex-wrap items-center gap-3">
        <AppButton
          tone="outline"
          variant="outline"
          type="button"
          onClick={() => setEditingSkills(true)}
        >
          {focusSkills.length ? "Edit skills" : "Choose skills"}
        </AppButton>
        <AppButton tone="gradient" asChild>
          <Link to="/plan">Open My Plan</Link>
        </AppButton>
      </div>
    ),
    description:
      "Find a course for the skills you want to grow, then make room for learning at your own pace.",
  };

  return (
    <div className="course-library">
      <PageHeader {...headerProps} />
      {selectionError && <p role="alert">{selectionError}</p>}
      {editingSkills ? (
        <LearningSkillPicker
          key={JSON.stringify([
            analysis?.occupationTitle,
            analysis?.tasks,
            evidence.map((item) => item.skill.wef_skill_id),
          ])}
          evidence={evidence}
          onSaved={refreshFocusSkills}
          onCancel={
            focusSkills.length ? () => setEditingSkills(false) : undefined
          }
        />
      ) : !focusSkills.length ? (
        <section className="learning-default-card library-glass">
          <div className="learning-default-copy">
            <p className="library-kicker">Ready when you are</p>
            <h2>Find your next learning step</h2>
            <p>
              Choose a skill reflected in your work, then explore resources and
              make room for learning at your own pace.
            </p>
            <AppButton tone="gradient" onClick={() => setEditingSkills(true)}>
              Choose skills <span aria-hidden="true">→</span>
            </AppButton>
          </div>
          <ol className="learning-default-steps">
            {[
              ["Choose a skill", "Start with a skill you want to develop."],
              ["Explore resources", "Compare relevant courses and chapters."],
              ["Make a little time", "Arrange a session that fits your week."],
            ].map(([title, description], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="library-intro library-glass">
          <div>
            <p className="library-kicker">Small steps. Practical progress.</p>
            <h2>
              Choose your skill.
              <br />
              Find your next learning step.
            </h2>
            <p>
              Explore learning resources, choose the chapters that matter to
              you, and set a weekly pace that fits your life.
            </p>
            <div className="library-intro-stats">
              <span>
                <strong>{courses.length}</strong> courses in the catalogue
              </span>
              <span>
                <strong>{focusSkills.length}</strong> focus skills
              </span>
            </div>
          </div>
          <div className="library-intro-note">
            <h3>Your learning, your choice</h3>
            <p>
              Save a course first, or open its details to choose chapters and
              study days.
            </p>
            <div className="library-intro-actions">
              <button
                type="button"
                className="library-intro-link"
                onClick={() => setEditingSkills(true)}
              >
                Edit your skills →
              </button>
              <AppButton tone="blue" onClick={() => setDrawerOpen(true)}>
                Saved courses · {state.saved.length}
                <Bookmark size={16} />
              </AppButton>
            </div>
          </div>
        </section>
      )}
      {notice && (
        <p className="library-notice" role="status">
          {notice}
        </p>
      )}
      {!editingSkills && focusSkills.length > 0 && (
        <>
          <div className="library-layout">
            <SkillSidebar {...sidebarProps} />
            <div
              className="library-results"
              role="region"
              aria-label="Course results"
              tabIndex={0}
            >
              {skill && <RecommendationBasis key={skill.id} {...basisProps} />}
              <CourseFilters {...filterProps} />
              <p className="library-muted" role="status">
                {skill
                  ? `${visible.length} of ${matching.length} courses for ${skill.en}`
                  : "Choose a focus skill to browse courses."}
              </p>
              <div className="library-course-list">
                {visible.map((course) => {
                  const cardProps = {
                    course,
                    saved: state.saved.includes(course.id),
                    skillId: activeId,
                    inPlan: plannedIds.includes(course.id),
                    scheduled: scheduledIds.includes(course.id),
                    onSave: () => toggleSave(course.id),
                    onDetails: () =>
                      setDetail({ id: course.id, planning: false }),
                  };
                  return <CourseCard key={course.id} {...cardProps} />;
                })}
              </div>
              {skill && !visible.length && (
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
              <div className="library-access">
                <Gift size={20} aria-hidden="true" />
                <p>
                  <strong>Selected for free learning access</strong>
                  <span>
                    Some providers require a free account. This catalogue comes
                    from the supplied reference; confirm current access and
                    course details on the provider page.
                  </span>
                </p>
              </div>
            </div>
          </div>
          <FloatingSavedCourses
            {...{ count: state.saved.length, onOpen: () => setDrawerOpen(true) }}
          />
        </>
      )}
      <SavedCoursesDrawer {...drawerProps} />
      {detailProps && (
        <CourseDetailDrawer key={detailCourse!.id} {...detailProps} />
      )}
    </div>
  );
}

import { useState } from "react";
import { Bookmark, BookOpen, Gift } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { Link } from "react-router-dom";
import SkillSidebar from "./components/SkillSidebar";
import CourseFilters, { emptyFilters } from "./components/CourseFilters";
import RecommendationBasis from "./components/RecommendationBasis";
import CourseCard from "./components/CourseCard";
import CourseDetailDrawer from "./components/CourseDetailDrawer";
import FloatingSavedCourses from "./components/FloatingSavedCourses";
import SavedCoursesDrawer from "./components/SavedCoursesDrawer";
import PendingLearningPlan from "./components/PendingLearningPlan";
import { courses } from "./catalogue";
import { useCourseLibrary } from "./hooks/useCourseLibrary";
import {
  readLearningSkills,
  coursesForSkill,
} from "@/pages/Skills/learningSkills";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import type { CourseChoice, RecommendationBasis as Basis } from "./types";
import "./course-library.css";
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
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<{
    id: string;
    planning: boolean;
  } | null>(null);
  const detailCourse = courses.find((course) => course.id === detail?.id);
  const plannedIds = state.pending.map((entry) => entry.courseId);
  const [selection] = useState(() => {
    try {
      return { skills: readLearningSkills() ?? [], error: "" };
    } catch {
      return {
        skills: [],
        error: "Your learning skills could not be loaded. Please reload.",
      };
    }
  });
  const focusSkills = selection.skills.map((item) => ({
    id: item.id,
    en: item.name,
    hint: "Selected for learning",
  }));
  const [activeId, setActiveId] = useState(focusSkills[0]?.id ?? "");
  const [analysis] = useState(readConfirmedAnalysis);
  const skill = focusSkills.find((item) => item.id === activeId);
  const matching = skill
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
  const pendingProps = {
    waitingCount: plannedIds.filter((id) => !scheduledIds.includes(id)).length,
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
        <AppButton tone="outline" variant="outline" asChild>
          <Link to="/skills#skill-directions">Edit skills</Link>
        </AppButton>
        <AppButton tone="gradient" onClick={() => setDrawerOpen(true)}>
          <Bookmark size={16} />
          Saved courses · {state.saved.length}
        </AppButton>
      </div>
    ),
    description:
      "Find a course for the skills you want to grow, then make room for learning at your own pace.",
  };
  return (
    <div className="course-library">
      <PageHeader {...headerProps} />
      {selection.error && <p role="alert">{selection.error}</p>}
      {!focusSkills.length && (
        <div className="library-glass p-6">
          <p>Choose your learning skills to find relevant courses.</p>
          <Link to="/skills#skill-directions">Choose skills →</Link>
        </div>
      )}
      <section className="library-intro library-glass">
        <div>
          <p className="library-kicker">Small steps. Practical progress.</p>
          <h2>
            Choose your skill.
            <br />
            Find your next learning step.
          </h2>
          <p>
            Explore learning resources, choose the chapters that matter to you,
            and set a weekly pace that fits your life.
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
          <BookOpen size={28} aria-hidden="true" />
          <h3>Your learning, your choice</h3>
          <p>
            Save a course first, or open its details to choose chapters and
            study days.
          </p>
          <Link to="/skills">Review your skills →</Link>
        </div>
      </section>
      {notice && (
        <p className="library-notice" role="status">
          {notice}
        </p>
      )}
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
                onDetails: () => setDetail({ id: course.id, planning: false }),
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
                Some providers require a free account. This catalogue comes from
                the supplied reference; confirm current access and course
                details on the provider page.
              </span>
            </p>
          </div>
        </div>
      </div>
      <PendingLearningPlan {...pendingProps} />
      <FloatingSavedCourses
        {...{ count: state.saved.length, onOpen: () => setDrawerOpen(true) }}
      />
      <SavedCoursesDrawer {...drawerProps} />
      {detailProps && (
        <CourseDetailDrawer key={detailCourse!.id} {...detailProps} />
      )}
    </div>
  );
}

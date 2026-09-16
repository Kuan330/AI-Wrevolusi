import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { useSearchParams } from "react-router-dom";
import SkillSidebar from "./components/SkillSidebar";
import CourseFilters, { emptyFilters } from "./components/CourseFilters";
import CourseCard from "./components/CourseCard";
import CourseDetailDrawer from "./components/CourseDetailDrawer";
import AddSkillDialog from "./components/AddSkillDialog";
import RemoveSkillDialog from "./components/RemoveSkillDialog";
import BotPet from "@/components/common/BotPet";
import { useCourseLibrary } from "./hooks/useCourseLibrary";
import { useBotPetGreeting } from "@/hooks/useBotPetGreeting";
import { fetchPageCatalogue } from "@/services/catalogueService";
import type { Course } from "./types";
import {
  ensureLearningSkills,
  toLearningSkill,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";
import { loadCourseDirectory } from "./lib/courseDirectory";
import { rateWefSkills } from "./lib/skillStars";
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
  /** Select the first skill after seeding when the list is empty. */
  const [activeId, setActiveId] = useState("");
  const { speech: petSpeech, say: sayPet } = useBotPetGreeting("learning");

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
    // Initialise once. Search links keep their whole-catalogue results, and
    // later deselection must not immediately select the first skill again.
    if (!params.get("q")) {
      setActiveId(current => current || next[0]?.id || "");
    }
    setSeeded(true);
  }, [wefSkills.length, workSkills, seeded, setSkills, params]);

  const focusSkills = skills.map((item: LearningSkill) => ({
    id: item.id,
    en: item.name,
    source: item.source,
  }));
  // Star band comes from the whole WEF framework, so it is rated once here
  // rather than per card.
  const skillRatings = useMemo(() => rateWefSkills(wefSkills), [wefSkills]);

  useEffect(() => {
    if (!activeId) return;
    if (!focusSkills.some((item) => item.id === activeId)) {
      setActiveId("");
    }
  }, [focusSkills, activeId]);

  const skill = focusSkills.find((item) => item.id === activeId);
  const [pageCourses, setPageCourses] = useState<Course[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueNotice, setCatalogueNotice] = useState("");
  const [catalogueLoading, setCatalogueLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const searchActive = Boolean(params.get("q"));
    // Courses only appear once a sidebar skill is selected; the search query
    // is the one exception and covers the whole catalogue.
    if (!searchActive && !activeId) {
      setPageCourses([]);
      setCatalogueNotice("");
      setCatalogueError("");
      setCatalogueLoading(false);
      return;
    }
    setCatalogueLoading(true);
    const skillId = searchActive ? null : activeId;
    void fetchPageCatalogue(skillId)
      .then((result) => {
        if (cancelled) return;
        setPageCourses(result.courses);
        setCatalogueNotice(result.notice ?? "");
        setCatalogueError("");
        setCatalogueLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogueError(
          "The course catalogue could not be loaded. Check your connection and try again.",
        );
        setCatalogueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, params.get("q")]);

  const matching = pageCourses;
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
  const detailCourse =
    pageCourses.find((course) => course.id === detailId) ?? null;
  const addedIds = new Set(skills.map((item) => item.id));

  const onToggleSave = (courseId: string) => {
    const wasSaved = state.saved.includes(courseId);
    toggleSave(courseId);
    if (!wasSaved) sayPet("add-course");
    else sayPet("remove-item");
  };

  const confirmRemoveSkill = async () => {
    if (!removeTarget) return;
    const removedId = removeTarget.id;
    const remainingIds = new Set(
      skills.filter((item) => item.id !== removedId).map((item) => item.id),
    );
    removeSkill(removedId);
    sayPet("remove-item");
    if (activeId === removedId) setActiveId("");
    setRemoveTarget(null);
    // Drop courses that only the removed skill linked to. Links come from the
    // backend catalogue, so this no longer depends on a bundled id map.
    try {
      const directory = await loadCourseDirectory();
      const dropCourses = [...directory.values()]
        .filter(
          (course) =>
            course.skills.includes(removedId) &&
            !course.skills.some((id) => remainingIds.has(id)),
        )
        .map((course) => course.id);
      if (dropCourses.length) {
        removeSavedCourses(dropCourses);
      }
    } catch {
      // Catalogue unreachable: leave the saved list untouched.
    }
  };

  const sidebarProps = {
    activeId,
    skills: focusSkills,
    ratings: skillRatings,
    onSelect: (skillId: string) => {
      setActiveId(skillId);
      setFilters({ ...emptyFilters });
    },
    onRemove: (id: string, name: string) => setRemoveTarget({ id, name }),
    onAdd: () => setAddOpen(true),
  };

  const filterProps = {
    value: filters,
    courses: matching,
    onChange: setFilters,
  };

  const headerProps = {
    title: "Learning Resources",
    description:
      "Browse courses for skills reflected in your work, or add skills you want to grow.",
  };

  return (
    <div className="course-library">
      <PageHeader {...headerProps} className="library-page-header" />
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
            {catalogueLoading && (
              <p className="library-muted" role="status">
                Loading courses…
              </p>
            )}
            {catalogueError && (
              <p className="library-muted" role="alert">
                {catalogueError}
              </p>
            )}
            {!catalogueLoading && catalogueNotice && (
              <p className="library-muted" role="status">
                {catalogueNotice}
              </p>
            )}
            <p className="library-muted" role="status">
              {skill
                ? `${visible.length} of ${matching.length} courses for ${skill.en}`
                : `${visible.length} of ${matching.length} courses in the catalogue`}
            </p>
            {!visible.length && !catalogueLoading ? (
              <div className="library-empty library-glass">
                <h3>
                  {matching.length
                    ? "No courses match these filters"
                    : !skill && !params.get("q")
                      ? "Select a skill to see its courses"
                      : "No matching courses yet"}
                </h3>
                <p>
                  {matching.length
                    ? "Try another format, provider or search term."
                    : !skill && !params.get("q")
                      ? "Choose a skill in the sidebar to browse its verified courses."
                      : "This skill stays in your learning list. The current catalogue has no linked courses yet."}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setFilters({ ...emptyFilters })}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="library-course-list">
                {visible.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    saved={state.saved.includes(course.id)}
                    onSave={() => onToggleSave(course.id)}
                    onDetails={() => setDetailId(course.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detailCourse && (
        <CourseDetailDrawer
          key={detailCourse.id}
          course={detailCourse}
          skillName={skill?.en ?? ""}
          saved={state.saved.includes(detailCourse.id)}
          onClose={() => setDetailId(null)}
          onSave={() => onToggleSave(detailCourse.id)}
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

      <BotPet
        storageKey="aiwrevolusi.botPetPosition.learning.v4"
        defaultCorner="top-right"
        speech={petSpeech}
      />
    </div>
  );
}

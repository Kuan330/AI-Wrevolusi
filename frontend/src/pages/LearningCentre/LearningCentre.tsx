import { cleanDisplayText, goalDisplayLabel } from "@/lib/displayText";
import { ROUTES } from "@/constants/routes";
import { readLearningGoals } from "@/features/learning-goals/learningGoals";
import LearningReviewNotice from "@/components/common/LearningReviewNotice";
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SkillSidebar from "./components/SkillSidebar";
import CourseFilters, { emptyFilters } from "./components/CourseFilters";
import CourseCard from "./components/CourseCard";
import CourseDetailDrawer from "./components/CourseDetailDrawer";
import AddSkillDialog from "./components/AddSkillDialog";
import RemoveSkillDialog from "./components/RemoveSkillDialog";
import { useCourseLibrary } from "./hooks/useCourseLibrary";
import { loadLearningCatalogue, resetCourseDirectory } from "@/features/learning-planning/courseDirectory";
import type { Course } from "../../features/learning-planning/types";
import {
  readLearningSkills,
  reconcileLearningSkills,
  toLearningSkill,
  saveLearningSkills,
  skillKey,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";
import { rateWefSkills } from "./lib/skillStars";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { useLearningSkills } from "@/pages/Skills/useLearningSkills";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { getSkillDecision, isSkillReviewCurrent, learningContextNeedsReview, readLearningContext, readJourneyProfile, readJourneyState, startLearning, type SkillDecision } from "@/features/journey/journey";
import type { CourseFilters as Filters } from "@/features/learning-planning/types";
import "./course-library.css";

export default function LearningCentre() {
  const navigate = useNavigate();
  const { state, notice, busy, pendingSync, retrySync, toggleSave, removeSavedCoursesForSkill } = useCourseLibrary();
  const { skills, setSkills, addSkill, removeSkill, refresh } = useLearningSkills();
  const [params, setParams] = useSearchParams();
  const genericSearch = (params.has("q") || params.get("mode") === "browse") && !params.has("context");
  const filters: Filters = {
    query: params.get("search") ?? params.get("q") ?? "",
    level: params.get("level") ?? "",
    provider: params.get("provider") ?? "",
    format: params.get("format") ?? "",
    language: params.get("language") ?? "",
    registration: params.get("registration") ?? "",
  };
  const setFilters = (next: Filters) => {
    const query = new URLSearchParams(params);
    for (const key of Object.keys(emptyFilters) as (keyof Filters)[]) {
      const param = key === "query" ? "search" : key;
      if (next[key]) query.set(param, next[key]);
      else query.delete(param);
    }
    if (genericSearch) query.set("q", next.query);
    setParams(query, { replace: true });
  };
  const detailId = params.get("course");
  const setDetailId = (id: string | null) => {
    const query = new URLSearchParams(params);
    if (id) query.set("course", id); else query.delete("course");
    setParams(query, { replace: !id });
  };
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [skillsError, setSkillsError] = useState("");
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const mounted = useRef(true);
  const seededWork = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    const changed = () => { refresh(); setWorkspaceRevision(value => value + 1); };
    window.addEventListener("workspace-change", changed);
    return () => { mounted.current = false; window.removeEventListener("workspace-change", changed); };
  }, [refresh]);

  const journey = useMemo(() => {
    try {
      const context = genericSearch || (params.has("goal") && !params.has("context")) ? null : readLearningContext(params.get("context"));
      const contextStale = Boolean(context && learningContextNeedsReview(context));
      return {
        revision: workspaceRevision,
        decisions: readJourneyState().review?.decisions ?? {},
        context,
        contextStale,
        reviewed: isSkillReviewCurrent(),
        profile: readJourneyProfile(),
        error: "",
      };
    } catch (error) {
      return { revision: workspaceRevision, decisions: {} as Record<string, SkillDecision>, context: null, contextStale: true, reviewed: false, profile: null,
        error: error instanceof Error ? error.message : "Your saved learning context could not be read. Please reload." };
    }
  }, [params, genericSearch, workspaceRevision]);
  const goalResource = useMemo(() => {
    void workspaceRevision;
    if (!params.has("goal")) return { goal: null, error: "" };
    try {
      const goal = readLearningGoals().find(item => item.id === params.get("goal")) ?? null;
      const contextMatches = !goal || genericSearch || !goal.sourceKey.startsWith("context:") || params.get("context") === goal.sourceKey.slice(8);
      return { goal, error: !goal ? "This goal could not be found. Open your saved goals to choose it again." : !contextMatches ? "The learning choice in this link does not match your goal. Open resources from your saved goal again." : "" };
    } catch { return { goal: null, error: "Your saved goal could not be read. Return to your goals and try again." }; }
  }, [params, workspaceRevision, genericSearch]);
  const resourceGoal = goalResource.goal;
  const unsupportedGoal = Boolean(resourceGoal && resourceGoal.initial.skill.source !== "wef" && !genericSearch);
  const context = journey.context;
  const evidence = useMemo(() => buildSkillEvidence(journey.profile?.tasks ?? [], wefSkills), [journey.profile, wefSkills]);
  const workSkills = useMemo(() => evidence.filter(({ skill }) =>
    journey.decisions[String(skill.wef_skill_id)] === "accepted" && (journey.reviewed ||
      (journey.context?.origin === "work" && !journey.contextStale && journey.context.skill.id === skill.wef_skill_id)))
    .map(({ skill }) => toLearningSkill(skill.core_skill, "work")),
    [evidence, journey.reviewed, journey.decisions, journey.context, journey.contextStale]);
  const selectedWef = context ? wefSkills.find(item => item.wef_skill_id === context.skill.id && skillKey(item.core_skill) === context.skill.slug) : undefined;
  const rejected = Boolean(context?.origin === "work" && selectedWef && !journey.error && getSkillDecision(selectedWef.wef_skill_id) === "rejected");
  const contextValid = Boolean(context && selectedWef && !rejected);
  const contextStale = journey.contextStale;
  const activeId = contextValid ? context!.skill.slug : "";
  const contextError = journey.error || (rejected
    ? "This skill was rejected in your review. Choose another skill or review that decision."
    : context && skillsLoaded && !selectedWef
      ? "This saved skill is not in the current WEF framework. Review your choice before continuing."
      : context && params.has("skill") && params.get("skill") !== context.skill.slug
        ? "The skill in this link does not match your saved learning choice. Return to your skill or career selection."
      : !genericSearch && !context && (params.has("context") || params.has("skill"))
        ? "This learning link could not be restored. Choose a skill below or return to your skill review."
        : "");

  useEffect(() => {
    let cancelled = false;
    const owner = currentWorkspaceSession();
    if (unsupportedGoal || goalResource.error) return;
    void referenceService.wefSkills().then(rows => {
      if (cancelled || owner !== currentWorkspaceSession()) return;
      setWefSkills([...rows].sort((a, b) => a.wef_skill_id - b.wef_skill_id));
      setSkillsLoaded(true);
    }).catch(() => {
      if (!cancelled && owner === currentWorkspaceSession()) setSkillsError("The skill framework could not be loaded. Please reload and try again.");
    });
    return () => { cancelled = true; };
  }, [unsupportedGoal, goalResource.error]);

  useEffect(() => {
    if (!skillsLoaded || journey.error || unsupportedGoal || goalResource.error) return;
    try {
      const saved = readLearningSkills();
      const workSeed = JSON.stringify(workSkills);
      const next = seededWork.current === workSeed ? [...(saved ?? [])] : reconcileLearningSkills(saved, workSkills);
      // A career selection can arrive before it has been added to the learning list.
      if (contextValid && !contextStale && selectedWef && !next.some(item => item.id === context!.skill.slug)) {
        next.push(toLearningSkill(selectedWef.core_skill, context!.origin === "career" ? "other-role" : context!.origin === "work" ? "work" : "wef"));
      }
      if (JSON.stringify(next) !== JSON.stringify(saved ?? [])) saveLearningSkills(next);
      seededWork.current = workSeed;
      setSkills(next);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Could not restore your learning skills.");
    }
  }, [skillsLoaded, workSkills, context?.id, context?.skill.slug, context?.origin, contextValid, contextStale, selectedWef, journey.error, unsupportedGoal, goalResource.error, setSkills]);

  const focusSkills = skills.filter(item => {
    const wef = wefSkills.find(row => skillKey(row.core_skill) === item.id);
    return item.source !== "work" || (!journey.error && wef && getSkillDecision(wef.wef_skill_id) === "accepted" && workSkills.some(work => work.id === item.id));
  }).map((item: LearningSkill) => ({ id: item.id, en: item.name, source: item.source }));
  const skill = focusSkills.find(item => item.id === activeId);
  const skillRatings = useMemo(() => rateWefSkills(wefSkills), [wefSkills]);
  const [pageCourses, setPageCourses] = useState<Course[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueNotice, setCatalogueNotice] = useState("");
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueRefresh, setCatalogueRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const owner = currentWorkspaceSession();
    setPageCourses([]);
    setCatalogueError("");
    setCatalogueNotice("");
    if ((!genericSearch && !activeId) || contextError || unsupportedGoal || goalResource.error) { setCatalogueLoading(false); return; }
    setCatalogueLoading(true);
    void loadLearningCatalogue(genericSearch ? null : activeId).then(result => {
      if (cancelled || owner !== currentWorkspaceSession()) return;
      setPageCourses(result.courses);
      setCatalogueNotice(result.notice ?? "");
      setCatalogueLoading(false);
    }).catch(() => {
      if (cancelled || owner !== currentWorkspaceSession()) return;
      setCatalogueError("The course catalogue could not be loaded. Check your connection and try again.");
      setCatalogueLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeId, genericSearch, contextError, unsupportedGoal, goalResource.error, catalogueRefresh]);

  const matching = pageCourses;
  const visible = matching.filter(course =>
    [course.title, course.provider, course.intro, ...course.outcomes].join(" ").toLowerCase().includes(filters.query.trim().toLowerCase()) &&
    (!filters.level || course.level === filters.level) && (!filters.provider || course.provider === filters.provider) &&
    (!filters.format || course.format === filters.format) && (!filters.language || course.language === filters.language) &&
    (!filters.registration || course.register === filters.registration));
  const detailCourse = pageCourses.find(course => course.id === detailId) ?? null;
  const addedIds = new Set(skills.map(item => item.id));

  const onToggleSave = async (courseId: string) => {
    const wasSaved = state.saved.includes(courseId);
    if (!wasSaved && (contextStale || contextError)) return;
    if (!(await toggleSave(courseId, contextValid && !contextStale ? context!.id : undefined))) return;
  };

  const selectSkill = async (id: string) => {
    if (selecting || journey.error) return;
    if (id === activeId && contextValid && !contextStale && !contextError) return;
    const row = wefSkills.find(item => skillKey(item.core_skill) === id);
    if (!row) {
      setSelectionError("Choose a supported WEF skill, or review your skill decisions first.");
      return;
    }
    const owner = currentWorkspaceSession();
    setSelecting(true);
    setSelectionError("");
    const work = journey.reviewed && getSkillDecision(row.wef_skill_id) === "accepted"
      ? evidence.find(item => item.skill.wef_skill_id === row.wef_skill_id) : undefined;
    try {
      const url = await startLearning({ origin: work ? "work" : "browse",
        skill: { id: row.wef_skill_id, slug: skillKey(row.core_skill), name: row.core_skill },
        taskIds: work?.tasks.map(task => task.id), taskLabels: work?.tasks.map(task => task.wording) });
      if (mounted.current && owner === currentWorkspaceSession()) navigate(url);
    } catch (error) {
      if (mounted.current && owner === currentWorkspaceSession()) setSelectionError(error instanceof Error ? error.message : "Could not save your learning choice.");
    } finally {
      if (mounted.current && owner === currentWorkspaceSession()) setSelecting(false);
    }
  };

  const confirmRemoveSkill = async () => {
    if (!removeTarget || busy || pendingSync) return;
    const removedId = removeTarget.id;
    const remainingIds = skills.filter(item => item.id !== removedId).map(item => item.id);
    removeSkill(removedId);
    if (removedId === activeId) navigate("/learning-centre?mode=browse", { replace: true });
    setRemoveTarget(null);
    await removeSavedCoursesForSkill(removedId, remainingIds);
  };
  const sidebarProps = {
    activeId, skills: focusSkills, ratings: skillRatings,
    onSelect: (id: string) => { void selectSkill(id); },
    onRemove: (id: string, name: string) => setRemoveTarget({ id, name }),
    onAdd: () => setAddOpen(true),
  };
  const filterProps = { value: filters, courses: matching, onChange: setFilters };

  const displayLearningError = (text: string) => /(?:status|http|request failed|fetch|network|timeout)/i.test(text) ? "The learning service is unavailable. Your saved choices are kept. Please try again." : cleanDisplayText(text);
  const headerProps = {
    title: "Find learning",
    description:
      "Optional courses to support your learning. Your saved goals stay available.",
  };

  return (
    <div className="course-library">
      <PageHeader {...headerProps} className="library-page-header" />
      <p className="library-goal-return"><Link to={resourceGoal ? `${ROUTES.learningGoals}?goal=${encodeURIComponent(resourceGoal.id)}` : ROUTES.learningGoals}>{resourceGoal ? "Back to this goal" : "Back to my goals"}</Link></p>
      {(!resourceGoal || resourceGoal.initial.skill.source === "wef") && <LearningReviewNotice />}
      {goalResource.error && <section className="library-glass library-goal-resource"><h2>Check your saved goal</h2><p role="alert">{goalResource.error}</p><Link to={ROUTES.learningGoals}>Open my goals</Link></section>}
      {resourceGoal && <section className="library-glass library-goal-resource" aria-label="Resources for your saved goal"><p className="library-kicker">Your saved goal</p><h2>{goalDisplayLabel(resourceGoal.wording, resourceGoal.initial.skill.label)}</h2><p>{cleanDisplayText(resourceGoal.initial.skill.label)}</p>
        {resourceGoal.initial.skill.source !== "wef" && <><p>There are no reviewed course links for this exact skill yet. You can still try your saved action and record what you learn.</p><div className="library-resource-actions"><Link to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(resourceGoal.id)}`}>Continue my action</Link>{!genericSearch && <Link to={`${ROUTES.learningCentre}?mode=browse&goal=${encodeURIComponent(resourceGoal.id)}`}>Browse all courses</Link>}</div>{genericSearch && <p className="library-muted">These are general courses. Adding one does not link it to this goal or prove that it covers this skill.</p>}</>}
      </section>}
      {context && contextValid && (
        <section className="library-glass mb-4 p-4" aria-label="Your learning choice">
          <p className="library-kicker">{context.origin === "career" ? "Career learning" : context.origin === "work" ? "From your reviewed skills" : "Your own learning choice"}</p>
          <h2>{cleanDisplayText(selectedWef?.core_skill ?? "")}</h2>
          {context.career && <p>For your chosen direction: {cleanDisplayText(context.career.title)}</p>}
          {context.taskLabels.length > 0 && <p>Connected work: {context.taskLabels.map(cleanDisplayText).join(". ")}</p>}
          {context.goal && <p>Your goal: {goalDisplayLabel(context.goal)}</p>}
          <p className="library-muted">This uses the current WEF skill and course links. It does not establish specialist skill coverage or job readiness.</p>
          {contextStale && <p role="alert">Your work or skill review changed. Review this choice before adding a new course; your saved courses are still available.</p>}
          <Link className="underline" to={context.origin === "career" ? "/possibilities" : "/skills"}>
            {context.origin === "career" ? "Back to your career direction" : "Review your skills"}
          </Link>
        </section>
      )}
      {genericSearch && <p className="mb-4" role="status">You are browsing the course catalogue on your own. Added courses are self-selected, not skill or career recommendations.</p>}
      {contextError && <div role="alert" className="mb-4"><p>{contextError}</p><Link className="underline" to="/skills">Review your skills</Link></div>}
      {!resourceGoal && !journey.reviewed && !context && !genericSearch && <p className="mb-4">Review your work skills to use them here, or add a skill to explore your own learning. <Link className="underline" to="/skills">Review skills</Link></p>}
      {(selectionError || selecting) && <p role={selectionError ? "alert" : "status"}>{selectionError ? displayLearningError(selectionError) : "Saving your skill choice…"}</p>}
      {!unsupportedGoal && !goalResource.error && <button type="button" className="mb-3 text-sm underline" disabled={catalogueLoading} onClick={() => { resetCourseDirectory(); setCatalogueRefresh(value => value + 1); }}>Refresh course catalogue</button>}
      {!unsupportedGoal && !goalResource.error && (skillsError || notice) && (
        <p role="alert">{displayLearningError(skillsError || notice)}</p>
      )}

      {pendingSync && <Button variant="outline" disabled={busy} onClick={() => { void retrySync(); }}>{busy ? "Syncing…" : "Retry course sync"}</Button>}
      {unsupportedGoal || goalResource.error ? null : !focusSkills.length && !genericSearch ? (
        <section className="learning-empty-skills library-glass">
          <p className="library-kicker">Ready when you are</p>
          <h2>Add skills to explore courses</h2>
          <p>
            Work skills appear here after you accept them in your skill review. You can also add skills from the WEF framework.
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
            {!catalogueError && <p className="library-muted" role="status">
              {skill
                ? `${visible.length} of ${matching.length} courses for ${skill.en}`
                : `${visible.length} of ${matching.length} courses in the catalogue`}
            </p>}
            {!visible.length && !catalogueLoading && !catalogueError ? (
              <div className="library-empty library-glass">
                <h3>
                  {matching.length
                    ? "No courses match these filters"
                    : !skill && !genericSearch
                      ? "Select a skill to see its courses"
                      : "No matching courses yet"}
                </h3>
                <p>
                  {matching.length
                    ? "Try another format, provider or search term."
                    : !skill && !genericSearch
                      ? "Choose a skill in the sidebar to browse the catalogue links."
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
                    busy={busy}
                    pendingSync={pendingSync}
                    saveDisabled={contextStale || Boolean(contextError)}
                    onSave={() => { if (!busy) void onToggleSave(course.id); }}
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
          skillName={cleanDisplayText(skill?.en ?? "")}
          saved={state.saved.includes(detailCourse.id)}
          busy={busy}
          pendingSync={pendingSync}
          saveNotice={displayLearningError(notice)}
          onRetrySync={() => { void retrySync(); }}
          saveDisabled={contextStale || Boolean(contextError)}
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

    </div>
  );
}

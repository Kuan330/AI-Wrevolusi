import { cleanDisplayText, goalDisplayLabel, taskListText } from "@/lib/displayText";
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
import { courseGroupRecord, groupProviderCourses } from "@/features/learning-planning/courseGroups";
import type { Course } from "../../features/learning-planning/types";
import {
  readLearningSkills,
  reconcileLearningSkills,
  toLearningSkill,
  saveLearningSkills,
  skillKey,
  type LearningSkill,
} from "@/features/skills/learningSkills";
import { rateWefSkills } from "./lib/skillStars";
import { buildSkillEvidence } from "../../features/skills/skillProfile.ts";
import { useLearningSkills } from "@/pages/Skills/useLearningSkills";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { getSkillDecision, isSkillReviewCurrent, learningContextNeedsReview, readLearningContext, readJourneyProfile, readJourneyState, startLearning, type SkillDecision } from "@/features/journey/journey";
import type { CourseFilters as Filters } from "@/features/learning-planning/types";
import { resolveCatalogueSkill } from "@/features/learning-planning/catalogueSkill";
import "./course-library.css";

export default function LearningCentre() {
  const navigate = useNavigate();
  const { state, notice, busy, pendingSync, retrySync, toggleSave, removeSavedCoursesForSkill } = useCourseLibrary();
  const { skills, setSkills, addSkill, removeSkill, refresh } = useLearningSkills();
  const [params, setParams] = useSearchParams();
  const genericSearch = !params.has("context") && (params.has("q") || params.get("mode") === "browse" || !params.has("goal"));
  const careerSkill = params.get("careerSkill")?.slice(0, 300) ?? "";
  const careerSkillUri = params.get("careerSkillUri") ?? "";
  const careerRole = params.get("careerRole")?.slice(0, 200) ?? "";
  const careerRoleUri = params.get("careerRoleUri") ?? "";
  const careerSourceVersion = params.get("careerSourceVersion")?.slice(0, 40) ?? "";
  const careerExploration = Boolean(careerSkill && careerRole && careerSourceVersion === "1.2.0"
    && /^http:\/\/data\.europa\.eu\/esco\/skill\/[0-9a-f-]{36}$/.test(careerSkillUri)
    && /^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f-]{36}$/.test(careerRoleUri));
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
  const browseSkill = genericSearch ? resolveCatalogueSkill(params.get("skill"), wefSkills) : null;
  const catalogueSkillId = genericSearch ? browseSkill?.slug ?? null : contextValid ? context!.skill.slug : null;
  const activeId = contextValid ? context!.skill.slug : "";
  const contextError = journey.error || (genericSearch && params.has("skill") && skillsLoaded && !browseSkill ? "This skill link is not in the current WEF framework. Choose a current skill or browse all courses." : "") || (rejected
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
    if (genericSearch && params.has("skill") && !skillsLoaded) { setCatalogueLoading(true); return; }
    if ((!genericSearch && !activeId) || contextError || unsupportedGoal || goalResource.error) { setCatalogueLoading(false); return; }
    setCatalogueLoading(true);
    void loadLearningCatalogue(catalogueSkillId, catalogueRefresh > 0).then(result => {
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
  }, [activeId, genericSearch, catalogueSkillId, skillsLoaded, params, contextError, unsupportedGoal, goalResource.error, catalogueRefresh]);

  const skillLabel = (id: string) => wefSkills.find(row => skillKey(row.core_skill) === id)?.core_skill ?? id.replace(/-/g, " ");
  const courseGroups = useMemo(() => genericSearch ? groupProviderCourses(pageCourses) : pageCourses.map(course => ({ course, mappings: [course] })), [pageCourses, genericSearch]);
  const matching = courseGroups.map(group => group.course);
  const visibleIds = new Set(pageCourses.filter(course =>
    [course.title, course.provider, course.intro, ...course.outcomes, ...course.skills.map(skillLabel)].join(" ").toLowerCase().includes(filters.query.trim().toLowerCase()) &&
    (!filters.level || course.level === filters.level) && (!filters.provider || course.provider === filters.provider) &&
    (!filters.format || course.format === filters.format) && (!filters.language || course.language === filters.language) &&
    (!filters.registration || course.register === filters.registration)).map(course => course.id));
  const visible = courseGroups.filter(group => group.mappings.some(course => visibleIds.has(course.id)));
  const detailCourse = pageCourses.find(course => course.id === detailId) ?? null;
  const detailGroup = courseGroups.find(group => group.mappings.some(course => course.id === detailId));
  const showSidebar = !genericSearch;
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

  const addLearningSkill = (name: string, source: LearningSkill["source"]) => {
    const added = addSkill(name, source);
    if (added && genericSearch) {
      setAddOpen(false);
      void selectSkill(skillKey(name));
    }
    return added;
  };

  const confirmRemoveSkill = async () => {
    if (!removeTarget || busy || pendingSync) return;
    const removedId = removeTarget.id;
    const remainingIds = skills.filter(item => item.id !== removedId).map(item => item.id);
    removeSkill(removedId);
    if (removedId === activeId) navigate(`${ROUTES.learningCentre}?mode=browse`, { replace: true });
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
    title: "Find courses",
    description:
      "Explore learning that fits your interests. Add a course and make it your own.",
    actions: <Link className="find-my-courses" to={ROUTES.plan}>My courses <span aria-hidden="true">→</span></Link>,
  };

  return (
    <div className="course-library find-courses">
      <PageHeader {...headerProps} className="library-page-header" />
      {browseSkill && <section className="library-glass library-goal-resource" aria-label="Courses for selected skill"><p className="library-kicker">From Skill path &amp; matching</p><h2>{cleanDisplayText(browseSkill.name)}</h2><p>These are catalogue links for this skill, not a skill assessment or a confirmed learning goal.</p><div className="library-resource-actions"><Link to={ROUTES.skills}>Back to Skill path &amp; matching</Link><Link to={`${ROUTES.learningCentre}?mode=browse`}>Browse all courses</Link><Link to={`${ROUTES.learningGoals}?${new URLSearchParams({ skill: browseSkill.slug })}`}>My learning plan for this skill</Link></div></section>}
      {careerExploration && <section className="library-glass library-goal-resource" aria-label="Career skill exploration">
        <p className="library-kicker">Career skill exploration · ESCO {careerSourceVersion}</p>
        <h2>{cleanDisplayText(careerSkill)}</h2>
        <p>Chosen from <strong>{cleanDisplayText(careerRole)}</strong>.</p>
        <p>Courses below are found by searching this skill name in the learning catalogue. The project does not have a reviewed ESCO-skill-to-course crosswalk yet, so check each course before adding it to a plan.</p>
        <Link to={ROUTES.possibilities}>Back to career options</Link>
      </section>}
      <p className="library-goal-return"><Link to={careerExploration ? ROUTES.possibilities : resourceGoal ? `${ROUTES.learningGoals}?goal=${encodeURIComponent(resourceGoal.id)}` : ROUTES.learningGoals}>{careerExploration ? "Back to career options" : resourceGoal ? "Back to this goal" : "Back to my goals"}</Link></p>
      {!genericSearch && (!resourceGoal || resourceGoal.initial.skill.source === "wef") && <LearningReviewNotice />}
      {goalResource.error && <section className="library-glass library-goal-resource"><h2>Check your saved goal</h2><p role="alert">{goalResource.error}</p><Link to={ROUTES.learningGoals}>Open my goals</Link></section>}
      {resourceGoal && <section className="library-glass library-goal-resource" aria-label="Resources for your saved goal"><p className="library-kicker">Your saved goal</p><h2>{goalDisplayLabel(resourceGoal.wording, resourceGoal.initial.skill.label)}</h2><p>{cleanDisplayText(resourceGoal.initial.skill.label)}</p>
        {resourceGoal.initial.skill.source !== "wef" && <><p>There are no reviewed course links for this exact skill yet. You can still try your saved action and record what you learn.</p><div className="library-resource-actions"><Link to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(resourceGoal.id)}`}>Continue my action</Link>{!genericSearch && <Link to={`${ROUTES.learningCentre}?mode=browse&goal=${encodeURIComponent(resourceGoal.id)}`}>Browse all courses</Link>}</div>{genericSearch && <p className="library-muted">These are general courses. Adding one does not link it to this goal or prove that it covers this skill.</p>}</>}
      </section>}
      {context && contextValid && (
        <section className="library-glass mb-4 p-4" aria-label="Your learning choice">
          <p className="library-kicker">{context.origin === "career" ? "Career learning" : context.origin === "work" ? "From your reviewed skills" : "Your own learning choice"}</p>
          <h2>{cleanDisplayText(selectedWef?.core_skill ?? "")}</h2>
          {context.career && <p>For your chosen direction: {cleanDisplayText(context.career.title)}</p>}
          {context.taskLabels.length > 0 && <p>Connected work: {taskListText(context.taskLabels)}</p>}
          {context.goal && <p>Your goal: {goalDisplayLabel(context.goal)}</p>}
          <p className="library-muted">This uses the current WEF skill and course links. It does not establish specialist skill coverage or job readiness.</p>
          {contextStale && <p role="alert">Your work or skill review changed. Review this choice before adding a new course; your saved courses are still available.</p>}
          <Link className="underline" to={context.origin === "career" ? ROUTES.possibilities : ROUTES.skills}>
            {context.origin === "career" ? "Back to your career direction" : "Review your skills"}
          </Link>
        </section>
      )}
      {genericSearch && <section className="find-courses-intro"><div><p className="library-kicker">A SMALL STEP. A NEW POSSIBILITY.</p><h2>What would you like to learn next?</h2><p>Explore provider courses, compare the details, and save what works for you. Learn at your own pace.</p></div><div className="find-courses-intro-note"><strong>{state.saved.length}</strong><span>saved learning records</span><Link to={ROUTES.plan}>Open my courses →</Link></div></section>}
      {genericSearch && <div className="library-browse-actions">
        <p className="library-browse-note">Browse courses on your own. Linked skills describe catalogue connections, not a recommendation for you.</p>
        <Button type="button" variant="outline" disabled={selecting || !skillsLoaded || Boolean(journey.error)} onClick={() => setAddOpen(true)}>Choose a skill for a goal</Button>
      </div>}
      {contextError && <div role="alert" className="mb-4"><p>{contextError}</p><Link className="underline" to={ROUTES.skills}>Review your skills</Link></div>}
      {!resourceGoal && !journey.reviewed && !context && !genericSearch && <p className="mb-4">Review your work skills to use them here, or add a skill to explore your own learning. <Link className="underline" to={ROUTES.skills}>Review skills</Link></p>}
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
        <div className={`library-layout${genericSearch ? " library-layout--browse" : ""}${genericSearch && showSidebar ? " library-layout--with-skills" : ""}`}>
          {showSidebar && (genericSearch ? <details className="library-browse-skills"><summary>Choose a saved skill for a goal</summary><SkillSidebar {...sidebarProps} /></details> : <SkillSidebar {...sidebarProps} />)}
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
                : `${visible.length} of ${matching.length} ${genericSearch ? "provider courses" : "courses"} in the catalogue`}
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
                      : "The current catalogue has no courses for this selection. Try browsing all courses or check again later."}
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
                {visible.map((group) => {
                  const matchingRecord = group.mappings.find(course => visibleIds.has(course.id)) ?? group.course;
                  const course = { ...matchingRecord, skills: group.course.skills };
                  const record = courseGroupRecord(group, state.saved, matchingRecord.id);
                  const saved = state.saved.includes(record.id);
                  return <CourseCard
                    key={group.course.id}
                    course={course}
                    saved={saved}
                    busy={busy}
                    pendingSync={pendingSync}
                    saveDisabled={contextStale || Boolean(contextError)}
                    linkedSkills={genericSearch ? course.skills.map(skillLabel) : undefined}
                    openSaved={genericSearch}
                    onSave={() => { if (!busy) { if (genericSearch && saved) setDetailId(record.id); else void onToggleSave(record.id); } }}
                    onDetails={() => setDetailId(record.id)}
                  />;
                })}
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
          linkedSkills={genericSearch ? detailGroup?.course.skills.map(skillLabel) : undefined}
          learningRecords={genericSearch ? detailGroup?.mappings.map(course => ({ id: course.id, label: course.skills.map(skillLabel).join(" · ") || "Course", saved: state.saved.includes(course.id) })) : undefined}
          onSelectRecord={setDetailId}
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
        onAdd={addLearningSkill}
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

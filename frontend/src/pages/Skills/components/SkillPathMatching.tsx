import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Clock3, GitBranch, LoaderCircle, Sparkles } from "lucide-react";
import { message } from "@/components/ui/message";
import { ROUTES } from "@/constants/routes";
import { recommendSkills } from "@/features/skills/recommendations";
import { buildSkillPath, skillPathDescription, type SkillRecommendation } from "@/features/skills/skillPath";
import { cachedCourseDirectory, loadLearningCatalogue } from "@/features/learning-planning/courseDirectory";
import { courseGroupRecord, groupProviderCourses } from "@/features/learning-planning/courseGroups";
import { changeSavedCourses } from "@/features/learning-planning/courseOperations";
import { readLibrary } from "@/features/learning-planning/libraryStorage";
import { currentWorkspaceSession, flushWorkspace } from "@/services/accountStorage";
import type { Course } from "@/features/learning-planning/types";
import type { ProfileTask } from "@/features/work-profile/types";
import type { WefSkill } from "@/types/reference";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { cleanDisplayText, shortTaskLabel } from "@/lib/displayText";
import { catalogueSkillSlug as skillKey, coursesForCatalogueSkill } from "@/features/learning-planning/catalogueSkill";
import "./skill-path.css";

type Props = { tasks: ProfileTask[]; skills: WefSkill[]; assessments: ConfirmedTaskExposureAssessment[]; decisions: Record<string, string>; loading: boolean };

function PathNode({ item, start = false, onExplore }: { item: SkillRecommendation; start?: boolean; onExplore: () => void }) {
  return <button type="button" className={`skill-path__node${start ? " is-start" : ""}`} onClick={onExplore} aria-label={`Explore ${item.skill.core_skill}`}>
    <span className="skill-path__node-label">{start ? <><Sparkles size={13} /> Suggested start</> : <><GitBranch size={13} /> Connected through your work</>}</span>
    <strong>{cleanDisplayText(item.skill.core_skill)}</strong>
  </button>;
}

const boneDelay = (index: number) => ({ "--bone-delay": `${index * 120}ms` } as CSSProperties);

/** Mirrors the path layout so the page shape is clear while the path is built. */
function PathSkeleton() {
  return <section className="skill-path is-loading" aria-busy="true" aria-label="Your recommended skill path">
    <p className="skill-path__loading-label" role="status"><LoaderCircle size={15} className="skill-path__spinner" aria-hidden="true" />Finding skill areas connected to your work…</p>
    <div className="skill-path__map" aria-hidden="true">
      <span className="skill-path__bone is-heading" />
      <div className="skill-path__graph has-connections">
        <span className="skill-path__bone is-node is-start" />
        <svg className="skill-path__connections" viewBox="0 0 90 240" preserveAspectRatio="none"><path d="M0 120 C45 120 45 56 90 56" /><path d="M0 120 C45 120 45 184 90 184" /></svg>
        <div className="skill-path__branches"><span className="skill-path__bone is-node" style={boneDelay(1)} /><span className="skill-path__bone is-node" style={boneDelay(2)} /></div>
      </div>
    </div>
    <div className="skill-path__cards" aria-hidden="true">{[0, 1, 2].map(index => <span key={index} className="skill-path__bone is-card" style={boneDelay(index)} />)}</div>
  </section>;
}

export default function SkillPathMatching({ tasks, skills, assessments, decisions, loading }: Props) {
  const navigate = useNavigate();
  const recommendations = useMemo(() => recommendSkills(tasks, skills, assessments, decisions), [tasks, skills, assessments, decisions]);
  const path = buildSkillPath(recommendations);
  const [openIds, setOpenIds] = useState<number[]>([]);
  // A repeat visit shows the last catalogue at once; the effect below refreshes it quietly.
  const [courses, setCourses] = useState<Course[] | null>(() => { const directory = cachedCourseDirectory(); return directory ? [...directory.values()] : null; });
  const [courseError, setCourseError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const hasOpenCard = openIds.length > 0;
  useEffect(() => {
    if (!hasOpenCard) return;
    let active = true;
    void loadLearningCatalogue(null, attempt > 0).then(result => {
      if (active) { setCourses(result.courses); setCourseError(""); }
    }).catch(() => { if (active && !cachedCourseDirectory()) setCourseError("We could not load the course catalogue. Your selected courses are still here. Try again."); });
    return () => { active = false; };
  }, [hasOpenCard, attempt]);
  let savedIds: string[] = [];
  let savedError = "";
  try { savedIds = readLibrary().saved; }
  catch (error) { savedError = error instanceof Error ? error.message : "Your saved courses could not be read. Reload before making changes."; }
  const groupsBySkill = useMemo(() => new Map(recommendations.map(item => [item.skill.wef_skill_id, groupProviderCourses(coursesForCatalogueSkill(courses ?? [], skillKey(item.skill.core_skill)))])), [courses, recommendations]);
  const pendingIds = selectedIds.filter(id => !savedIds.includes(id));
  const hasHighAssistance = recommendations.some(item => item.highTaskCount > 0);

  function explore(id: number) {
    setOpenIds(current => current.includes(id) ? current : [...current, id]);
    requestAnimationFrame(() => {
      document.getElementById(`skill-area-${id}`)?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      document.getElementById(`skill-area-toggle-${id}`)?.focus({ preventScroll: true });
    });
  }

  async function addToLearningPlan() {
    if (lock.current || !selectedIds.length || savedError) return;
    const owner = currentWorkspaceSession();
    lock.current = true; setSaving(true); setSaveError("");
    try {
      if (pendingIds.length) await changeSavedCourses({ add: pendingIds });
      await flushWorkspace();
      if (mounted.current && owner === currentWorkspaceSession()) {
        navigate(ROUTES.plan);
        message.success(`${selectedIds.length} ${selectedIds.length === 1 ? "course" : "courses"} added to your learning plan.`, 4500);
      }
    } catch (error) {
      if (mounted.current && owner === currentWorkspaceSession()) setSaveError(error instanceof Error ? error.message : "Your courses could not be saved. Your choices are kept. Try again.");
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  }

  if (loading) return <PathSkeleton />;
  if (!path.start) return <section className="skill-path__empty"><BookOpen size={28} /><h2>Your path starts with one task</h2><p>No supported skill areas were found in your current task wording. Review a task to search the catalogue or add a skill in your own words.</p><Link to={`${ROUTES.skills}?view=task`}>Review my tasks <ArrowRight size={16} /></Link></section>;

  return <section className="skill-path" aria-label="Your recommended skill path">
    <div className="skill-path__intro"><p>{recommendations.length} skill {recommendations.length === 1 ? "area" : "areas"} from your confirmed tasks{hasHighAssistance ? ", AI-assisted tasks first" : ""}.</p><Link className="skill-path__plan-link" to={ROUTES.learningGoals}>My learning plan <ArrowUpRight size={16} /></Link></div>

    <section className="skill-path__map" aria-labelledby="skill-path-heading">
      <header><div><h2 id="skill-path-heading">Your starting point</h2></div></header>
      <div className={`skill-path__graph${path.connected.length ? " has-connections" : ""}`}>
        <PathNode item={path.start} start onExplore={() => explore(path.start!.skill.wef_skill_id)} />
        {path.connected.length > 0 && <><svg className="skill-path__connections" viewBox="0 0 90 240" preserveAspectRatio="none" aria-hidden="true">
          {path.connected.length === 1 ? <path d="M0 120 H90" /> : <><path d="M0 120 C45 120 45 56 90 56" /><path d="M0 120 C45 120 45 184 90 184" /></>}
        </svg><div className="skill-path__branches">{path.connected.map(item => <PathNode key={item.skill.wef_skill_id} item={item} onExplore={() => explore(item.skill.wef_skill_id)} />)}</div></>}
      </div>
      {path.additional.length > 0 && <div className="skill-path__additional"><p>Other areas to explore</p><div>{path.additional.map(item => <button type="button" key={item.skill.wef_skill_id} onClick={() => explore(item.skill.wef_skill_id)}><span>{cleanDisplayText(item.skill.core_skill)}</span><ArrowDown size={16} /></button>)}</div></div>}
    </section>

    <section className="skill-path__areas" aria-labelledby="skill-areas-heading">
      <header><h2 id="skill-areas-heading">Skill areas</h2></header>
      <div className="skill-path__cards">{recommendations.map((item, index) => {
        const id = item.skill.wef_skill_id;
        const open = openIds.includes(id);
        const matches = groupsBySkill.get(id) ?? [];
        const reviewLink = `${ROUTES.skills}?${new URLSearchParams({ view: "task", task: item.tasks[0].id, skill: String(id) })}`;
        return <article className={`skill-path__card tone-${index % 3}${open ? " is-open" : ""}`} id={`skill-area-${id}`} key={id} style={{ "--path-delay": `${index * 55}ms` } as CSSProperties}>
          <div className="skill-path__card-top"><span className="skill-path__icon"><BookOpen size={20} /></span></div>
          <h3>{cleanDisplayText(item.skill.core_skill)}</h3><p>{skillPathDescription(id)}</p>
          <details className="skill-path__evidence"><summary>Why this area? · {item.tasks.length} {item.tasks.length === 1 ? "task" : "tasks"}</summary><ul>{item.tasks.map(task => <li key={task.id}>{shortTaskLabel(task.wording, 180)}</li>)}</ul><p>Suggested from task wording. Check whether it fits your work.</p><Link className="skill-path__review" to={reviewLink} state={{ taskWording: item.tasks[0].wording }}>Review this skill connection <ArrowUpRight size={14} /></Link></details>
          <button className="skill-path__expand" type="button" id={`skill-area-toggle-${id}`} aria-expanded={open} aria-controls={`skill-area-courses-${id}`} onClick={() => setOpenIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])}>{open ? "Hide courses" : "Explore courses"}<ChevronDown size={16} /></button>
          {open && <div className="skill-path__courses" id={`skill-area-courses-${id}`}>{courseError ? <div role="alert"><p>{courseError}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : !courses ? <div className="skill-path__course-loading" role="status"><span className="sr-only">Loading courses…</span>{[0, 1, 2].map(index => <span key={index} className="skill-path__bone is-course" aria-hidden="true" style={boneDelay(index)} />)}</div> : !matches.length ? <div className="skill-path__no-courses"><p>No verified courses are linked to this area yet. You can still create a learning goal from your task review.</p><Link to={reviewLink} state={{ taskWording: item.tasks[0].wording }}>Choose a learning goal <ArrowRight size={14} /></Link></div> : <>{matches.slice(0, 3).map(group => {
            const course = courseGroupRecord(group, savedIds);
            const saved = savedIds.includes(course.id);
            const checked = saved || selectedIds.includes(course.id);
            return <div className={`skill-path__course${checked ? " is-selected" : ""}`} key={course.id}><label><input type="checkbox" checked={checked} disabled={saving || saved || Boolean(savedError)} onChange={event => { const next = event.target.checked; setSelectedIds(current => next ? [...new Set([...current, course.id])] : current.filter(value => value !== course.id)); setSaveError(""); }} /><span><strong>{cleanDisplayText(group.course.title)}</strong><small>{group.course.provider}{group.course.level !== "unknown" ? ` · ${group.course.level}` : ""}</small><small>{saved ? <><Check size={12} /> Already in your plan</> : group.course.durationMin ? <><Clock3 size={12} /> {group.course.durationMin} min</> : "Duration not listed"}</small></span></label><Link to={`${ROUTES.learningCentre}?${new URLSearchParams({ mode: "browse", course: course.id, skill: skillKey(item.skill.core_skill) })}`} aria-label={`Course details for ${group.course.title}`}>Details <ArrowUpRight size={12} /></Link></div>;
          })}{matches.length > 3 && <Link className="skill-path__all-courses" to={`${ROUTES.learningCentre}?${new URLSearchParams({ mode: "browse", skill: skillKey(item.skill.core_skill) })}`}>Browse all {matches.length} courses <ArrowRight size={14} /></Link>}</>}</div>}
        </article>;
      })}</div>
    </section>

    <div className={`skill-path__planbar${pendingIds.length || saveError ? " has-selection" : ""}`}><div><span><BookOpen size={19} /><strong>{pendingIds.length ? `${pendingIds.length} ${pendingIds.length === 1 ? "course" : "courses"} selected for your next step` : "Choose your next courses"}</strong></span><p>{saveError ? "Your choices are kept here. Retry to confirm they are saved to your account." : pendingIds.length ? "Save your selections and continue in My courses." : "Select at least one course to add to your learning plan."}</p></div><button type="button" disabled={saving || Boolean(savedError) || (!pendingIds.length && !saveError)} onClick={() => { void addToLearningPlan(); }}>{saving ? "Saving your courses…" : saveError ? "Retry saving courses" : "Add to my learning plan"}<ArrowRight size={17} /></button>{(saveError || savedError) && <p role="alert">{saveError || savedError}</p>}</div>
    <p className="skill-path__footnote">Suggestions come from your task wording and the WEF skills framework. They do not measure your skill level.</p>
  </section>;
}

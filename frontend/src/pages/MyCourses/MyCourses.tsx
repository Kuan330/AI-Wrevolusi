import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, History, Check, ChevronRight, Clock, ExternalLink, Search, Trash2 } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { cleanDisplayText } from "@/lib/displayText";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCourseLibrary } from "@/pages/LearningCentre/hooks/useCourseLibrary";
import { durationLabel } from "@/pages/LearningCentre/lib/coursePlanning";
import { courseLevelLabel } from "@/pages/LearningCentre/lib/courseLevels";
import { loadCourseDirectory } from "@/features/learning-planning/courseDirectory";
import { readPlanState, syncPlanWithLearningCourses, type PlanState } from "@/features/learning-planning/planCourses";
import { refreshChapterProgress, saveChapterProgress, syncChapterProgress } from "@/features/learning-planning/progressOperations";
import { rememberCourse, readJourneyState } from "@/features/journey/journey";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { courseProgress, filterSavedCourses, safeProviderUrl, selectedChapter, statusLabel } from "@/features/course-workspace/courseWorkspace";
import type { Course } from "@/features/learning-planning/types";
import "./my-courses.css";

function initialPlan() {
  try { return { plan: readPlanState(), error: "" }; }
  catch { return { plan: { version: 1, courses: [], records: {} } as PlanState, error: "Your saved courses could not be read. Reload before making changes; your data has not been overwritten." }; }
}
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function MyCourses() {
  const [initial] = useState(initialPlan);
  const [plan, setPlan] = useState(initial.plan);
  const [readError, setReadError] = useState(initial.error);
  const [directory, setDirectory] = useState(new Map<string, Course>());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [revision, setRevision] = useState(0);
  const [progressBusy, setProgressBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const mounted = useRef(true);
  const actionLock = useRef(false);
  const { state: library, notice, busy, pendingSync, retrySync, toggleSave } = useCourseLibrary();
  const [params, setParams] = useSearchParams();
  const owner = currentWorkspaceSession();
  const query = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const courseId = params.get("course");
  const course = plan.courses.find(item => item.id === courseId);
  const metadata = course ? directory.get(course.id) : undefined;
  const chapterIndex = course ? selectedChapter(course, params.get("chapter")) : 0;
  const progress = course ? courseProgress(course) : null;
  const selection = useRef("");
  selection.current = `${courseId}:${chapterIndex}`;
  const previousOwner = useRef(owner);
  const providerUrl = safeProviderUrl(metadata?.url);
  const visible = filterSavedCourses(plan.courses, query, status);
  const completed = plan.courses.filter(item => courseProgress(item).status === "completed").length;
  let resumeId: string | undefined;
  try { const resume = readJourneyState().resume; if (resume?.kind === "course") resumeId = resume.id; } catch { /* Course data remains usable without journey metadata. */ }
  const nextCourse = plan.courses.find(item => item.id === resumeId && courseProgress(item).status !== "completed") ?? plan.courses.find(item => courseProgress(item).status === "in-progress") ?? plan.courses.find(item => courseProgress(item).status !== "completed");
  const changeParam = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const backToCourses = () => { const next = new URLSearchParams(params); next.delete("course"); next.delete("chapter"); setParams(next); };

  useEffect(() => {
    mounted.current = true;
    const refresh = () => { const result = initialPlan(); setPlan(result.plan); setReadError(result.error); };
    window.addEventListener("workspace-change", refresh);
    return () => { mounted.current = false; window.removeEventListener("workspace-change", refresh); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const live = () => !cancelled && owner === currentWorkspaceSession();
    if (previousOwner.current !== owner) {
      previousOwner.current = owner; actionLock.current = false;
      setProgressBusy(false); setOpening(false); setActionError(""); setFeedback(""); setRemoveId(null);
    }
    setLoading(true); setLoadError(""); setDirectory(new Map());
    void (async () => {
      try {
        const catalogue = await loadCourseDirectory(revision > 0);
        if (!live()) return;
        setDirectory(catalogue);
        const synced = await syncPlanWithLearningCourses();
        if (!live()) return;
        setPlan(synced);
        try { const current = await refreshChapterProgress(); if (live()) setPlan(current); }
        catch { if (live()) setLoadError("Account progress could not refresh. Showing progress saved on this browser."); }
      } catch { if (live()) setLoadError("The catalogue is unavailable. Your saved courses and recorded progress are still here."); }
      finally { if (live()) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [owner, revision]);

  async function openCourse(id: string) {
    if (actionLock.current || busy || pendingSync || readError) return;
    actionLock.current = true; setOpening(true); setActionError(""); setFeedback("");
    const session = currentWorkspaceSession();
    try {
      await rememberCourse(id);
      if (!mounted.current || session !== currentWorkspaceSession()) return;
      const next = new URLSearchParams(params); next.set("course", id); next.delete("chapter"); setParams(next);
    } catch { if (mounted.current && session === currentWorkspaceSession()) setActionError("Could not save your place. Please try again."); }
    finally { if (session === currentWorkspaceSession()) actionLock.current = false; if (mounted.current && session === currentWorkspaceSession()) setOpening(false); }
  }
  async function recordProgress(value: number, advance = false) {
    if (!course || !course.chapters.length || actionLock.current || busy || pendingSync || readError) return;
    actionLock.current = true; setProgressBusy(true); setActionError(""); setFeedback("");
    const session = currentWorkspaceSession();
    let locallySaved = false;
    try {
      const values = course.chapters.map((chapter, index) => index === chapterIndex ? value : chapter.value);
      setPlan(saveChapterProgress(course.id, values, localDate())); locallySaved = true;
      const synced = await syncChapterProgress();
      if (!mounted.current || session !== currentWorkspaceSession()) return;
      setPlan(synced); setFeedback("Progress saved to your learning records.");
      if (advance && selection.current === `${course.id}:${chapterIndex}` && chapterIndex + 1 < course.chapters.length) changeParam("chapter", String(chapterIndex + 1));
    } catch {
      if (mounted.current && session === currentWorkspaceSession()) setActionError(locallySaved ? "Progress is saved on this browser but has not synced to your account. Retry when connected." : "Progress could not be saved. Please try again.");
    } finally { if (session === currentWorkspaceSession()) actionLock.current = false; if (mounted.current && session === currentWorkspaceSession()) setProgressBusy(false); }
  }
  async function retryProgress() {
    if (actionLock.current) return;
    actionLock.current = true; setProgressBusy(true);
    const session = currentWorkspaceSession();
    try { const next = await syncChapterProgress(); if (mounted.current && session === currentWorkspaceSession()) { setPlan(next); setActionError(""); setFeedback("Progress synced to your account."); } }
    catch { if (mounted.current && session === currentWorkspaceSession()) setActionError("Progress still could not sync. Your recorded progress is kept on this browser."); }
    finally { if (session === currentWorkspaceSession()) actionLock.current = false; if (mounted.current && session === currentWorkspaceSession()) setProgressBusy(false); }
  }
  const disabled = progressBusy || busy || pendingSync || opening || Boolean(readError);
  return <div className="my-courses">
    <header className="courses-heading"><div><p className="courses-eyebrow">MY LEARNING PLAN</p><h1>{course ? "Your learning workspace" : "My courses"}</h1><p>{course ? "A clear next step, at your own pace." : "Keep your learning in one place. Pick up where you left off."}</p></div><div className="courses-heading-actions"><Link className="courses-secondary" to={ROUTES.progress}><History size={16} /> View learning records</Link><Link className="courses-primary" to={`${ROUTES.learningCentre}?mode=browse`}>Find courses <ArrowRight size={16} /></Link></div></header>
    {(readError || notice || actionError) && <div className="courses-notice" role="alert">{readError || notice || actionError}</div>}
    {loadError && <div className="courses-notice" role="status">{loadError} <button onClick={() => setRevision(value => value + 1)} disabled={loading}>Retry loading</button></div>}
    {feedback && <p className="courses-feedback" role="status">{feedback}</p>}
    {pendingSync && <Button disabled={busy} variant="outline" onClick={() => { void retrySync(); }}>Retry course sync</Button>}
    {Boolean(plan.pendingProgress?.length) && <div className="courses-notice" role="status">Some progress is waiting to sync. <button onClick={() => { void retryProgress(); }} disabled={progressBusy}>Retry progress sync</button></div>}
    {courseId && !course && !loading && <section className="courses-empty"><h2>This course is not in your saved list</h2><p>It may have been removed. Your other courses are still available.</p><button className="courses-secondary" onClick={backToCourses}>Back to my courses</button></section>}
    {course && progress ? <>
      <button className="courses-back" onClick={backToCourses}><ArrowLeft size={16} /> All my courses</button>
      <div className="course-study-layout">
        <aside className="course-outline"><p className="courses-eyebrow">COURSE OUTLINE</p><h2>{cleanDisplayText(course.title)}</h2><div className="courses-progress-label"><span>{progress.completed} of {progress.total} sections complete</span><strong>{progress.percent}%</strong></div><progress max={100} value={progress.percent} aria-label="Course progress" /><nav aria-label="Course sections">{course.chapters.map((chapter, index) => <button key={`${index}:${chapter.title}`} aria-current={index === chapterIndex ? "step" : undefined} onClick={() => { setFeedback(""); changeParam("chapter", String(index)); }}><span className={`course-step ${chapter.value === 10 ? "done" : ""}`}>{chapter.value === 10 ? <Check size={14} /> : index + 1}</span><span>{cleanDisplayText(chapter.title)}</span><ChevronRight size={14} /></button>)}</nav><p className="courses-caption">Sections are available in any order. Progress reflects your own study, not a skills assessment.</p></aside>
        <article className="course-study-content"><p className="courses-eyebrow">{cleanDisplayText(course.provider)} · SECTION {chapterIndex + 1} OF {progress.total}</p><h2>{cleanDisplayText(course.chapters[chapterIndex]?.title ?? course.title)}</h2><div className="courses-meta"><span>{metadata ? courseLevelLabel(metadata.level) : "Saved course"}</span><span><Clock size={14} /> {durationLabel(metadata?.chapters?.[chapterIndex]?.min ?? null)}</span><span>{statusLabel(progress.status)}</span></div>
          {metadata?.outcomes.length ? <section className="course-outcomes"><p className="courses-eyebrow">WHAT THIS COURSE COVERS</p><h3>Put your learning into practice</h3><ul>{metadata.outcomes.map((outcome, index) => <li key={index}><Check size={16} />{cleanDisplayText(outcome)}</li>)}</ul></section> : null}
          <section className="course-study-card"><div className="course-study-icon"><BookOpen size={25} /></div><h3>Learn with {cleanDisplayText(course.provider)}</h3><p>{cleanDisplayText(metadata?.intro || "Use your provider’s course materials to work through this section, then come back to record your progress.")}</p><p className="courses-caption">Course content is hosted by the provider. AI-Wrevolusi keeps your course list and study progress; it does not generate or host these lessons.</p>{providerUrl ? <a className="courses-primary" href={providerUrl} target="_blank" rel="noopener noreferrer">Open course materials <ExternalLink size={16} /></a> : <p className="courses-caption">The provider link is unavailable right now. Refresh the catalogue to check again.</p>}{metadata?.prereq && <p><strong>Before you start:</strong> {cleanDisplayText(metadata.prereq)}</p>}</section>
          <section className="course-record-card"><div><p className="courses-eyebrow">YOUR STUDY PROGRESS</p><h3>{course.chapters[chapterIndex]?.value === 10 ? "Section complete. Well done." : "How far did you get?"}</h3><p>Your progress is recorded in Learning history. It does not verify mastery of a skill.</p></div><label>Section progress<select value={course.chapters[chapterIndex]?.value ?? 0} disabled={disabled} onChange={event => { void recordProgress(Number(event.target.value)); }}>{Array.from({ length: 11 }, (_, value) => <option key={value} value={value} disabled={value < (course.chapters[chapterIndex]?.value ?? 0)}>{value * 10}%</option>)}</select></label><button className="courses-primary" disabled={disabled || course.chapters[chapterIndex]?.value === 10} onClick={() => { void recordProgress(10, true); }}>{progressBusy ? "Saving…" : chapterIndex + 1 < course.chapters.length ? "Mark complete & continue" : "Mark complete"}<Check size={16} /></button></section>
          <div className="course-section-nav"><button className="courses-secondary" disabled={chapterIndex === 0} onClick={() => changeParam("chapter", String(chapterIndex - 1))}><ArrowLeft size={15} /> Previous section</button><button className="courses-secondary" disabled={chapterIndex + 1 >= course.chapters.length} onClick={() => changeParam("chapter", String(chapterIndex + 1))}>Next section <ArrowRight size={15} /></button></div>
        </article>
      </div>
    </> : !courseId ? <>
      <section className="courses-overview" aria-label="Course summary"><div><BookOpen size={19} /><strong>{plan.courses.length}</strong><span>Saved courses</span></div><div><Clock size={19} /><strong>{plan.courses.filter(item => courseProgress(item).status === "in-progress").length}</strong><span>In progress</span></div><div><Check size={19} /><strong>{completed}</strong><span>Completed</span></div></section>
      {nextCourse && <section className="courses-resume"><div><p className="courses-eyebrow">CONTINUE YOUR LEARNING</p><h2>{cleanDisplayText(nextCourse.title)}</h2><p>Next up: {cleanDisplayText(nextCourse.chapters[courseProgress(nextCourse).nextChapter]?.title ?? "Open your course")}</p><div className="courses-progress-label"><span>{courseProgress(nextCourse).completed} of {courseProgress(nextCourse).total} sections complete</span><strong>{courseProgress(nextCourse).percent}%</strong></div><progress max={100} value={courseProgress(nextCourse).percent} aria-label="Next course progress" /></div><button className="courses-primary" disabled={disabled} onClick={() => { void openCourse(nextCourse.id); }}>{opening ? "Opening…" : courseProgress(nextCourse).status === "not-started" ? "Start learning" : "Continue learning"}<ArrowRight size={16} /></button></section>}
      <div className="courses-toolbar"><label className="courses-search"><Search size={17} /><input aria-label="Search my courses" value={query} onChange={event => changeParam("search", event.target.value)} placeholder="Search your courses" /></label><div className="courses-status-filter" role="group" aria-label="Filter courses by progress">{[["", "All courses"], ["in-progress", "In progress"], ["not-started", "Not started"], ["completed", "Completed"]].map(([value, label]) => <button key={value} aria-pressed={status === value} onClick={() => changeParam("status", value)}>{label}</button>)}</div></div>
      {loading && <p role="status" className="courses-caption">Refreshing your courses…</p>}
      <p role="status" className="courses-caption">{visible.length} {visible.length === 1 ? "course" : "courses"}{query || status ? " match your filters" : " in your learning list"}</p>
      <div className="saved-courses-grid">{visible.map(item => { const info = directory.get(item.id); const value = courseProgress(item); return <article className="saved-course-card" key={item.id}><div className="courses-card-top"><span className="courses-eyebrow">{cleanDisplayText(item.provider)}</span><span className={`courses-status courses-status--${value.status}`}>{statusLabel(value.status)}</span></div><div className="saved-course-icon"><BookOpen size={23} /></div><h2>{cleanDisplayText(item.title)}</h2><p>{cleanDisplayText(info?.intro || "Your saved learning resource. Open it to see the course outline and record your progress.")}</p><div className="courses-meta"><span>{info ? courseLevelLabel(info.level) : "Saved course"}</span><span>{durationLabel(info?.durationMin ?? null)}</span><span>{value.total} sections</span></div><div className="courses-progress-label"><span>{value.completed} of {value.total} complete</span><strong>{value.percent}%</strong></div><progress max={100} value={value.percent} aria-label={`${cleanDisplayText(item.title)} progress`} /><div className="saved-course-actions"><button className="courses-secondary" disabled={disabled} onClick={() => { void openCourse(item.id); }}>{value.status === "completed" ? "Review course" : value.status === "in-progress" ? "Continue" : "Start course"}<ArrowRight size={15} /></button><button className="courses-remove" disabled={disabled} aria-label={`Remove ${cleanDisplayText(item.title)}`} onClick={() => setRemoveId(item.id)}><Trash2 size={16} /></button></div></article>; })}</div>
      {!visible.length && !loading && <section className="courses-empty"><BookOpen size={32} /><h2>{plan.courses.length ? "No courses match your filters" : "Your next chapter starts here"}</h2><p>{plan.courses.length ? "Try a different course name or progress filter." : "Find a course that fits your interests, add it to your list, and learn at your own pace."}</p>{plan.courses.length ? <button className="courses-secondary" onClick={() => { const next = new URLSearchParams(params); next.delete("search"); next.delete("status"); setParams(next, { replace: true }); }}>Clear filters</button> : <Link className="courses-primary" to={`${ROUTES.learningCentre}?mode=browse`}>Explore courses <ArrowRight size={16} /></Link>}</section>}
      {library.saved.some(id => !plan.courses.some(item => item.id === id)) && <p className="courses-notice">Some saved course records are waiting for catalogue details. They have not been deleted. <button disabled={loading} onClick={() => setRevision(value => value + 1)}>Retry loading</button></p>}
    </> : loading ? <p role="status">Loading your course…</p> : null}
    <Dialog open={Boolean(removeId)} onOpenChange={open => { if (!open && !busy) setRemoveId(null); }}><DialogContent><DialogTitle>Remove this course?</DialogTitle><DialogDescription>This removes it from your current learning list. Existing learning-history entries are kept. Find courses lets you add it again later.</DialogDescription><div className="courses-heading-actions"><Button variant="outline" disabled={busy} onClick={() => setRemoveId(null)}>Keep course</Button><Button disabled={disabled} onClick={async () => { if (removeId && await toggleSave(removeId)) setRemoveId(null); }}>{busy ? "Removing…" : "Remove course"}</Button></div></DialogContent></Dialog>
  </div>;
}

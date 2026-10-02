import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useAccount } from "@/components/account/useAccount";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { ApiError } from "@/services/api";
import { onboardingSaveError } from "@/features/learning-onboarding/learningOnboardingErrors";
import { cachedCourseDirectory, loadLearningCatalogue } from "@/features/learning-planning/courseDirectory";
import { resolveCatalogueSkill } from "@/features/learning-planning/catalogueSkill";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import type { Course } from "@/features/learning-planning/types";
import type { LearningPlanInputs } from "@/features/learning-goals/personalLearningPlan";
import type { LearningPlanResource } from "@/features/learning-goals/learningPlanSetup";
import { completeLearningOnboarding, createOnboardingRecords, onboardingStatus } from "@/features/learning-onboarding/learningOnboarding";
import LearningPlanPreferences from "./LearningPlanPreferences";
import "./learning-plan-onboarding.css";

export default function LearningPlanOnboarding({ children }: { children: ReactNode }) {
  const { user, loading } = useAccount();
  const [session, setSession] = useState(currentWorkspaceSession);
  useEffect(() => {
    const changed = () => setSession(currentWorkspaceSession());
    window.addEventListener("workspace-change", changed);
    return () => window.removeEventListener("workspace-change", changed);
  }, []);
  if (loading) return <p role="status">Loading your learning plan…</p>;
  if (!user) return <>{children}</>;
  return <LearningPlanEntry key={`${user.id}:${session}`}>{children}</LearningPlanEntry>;
}

function LearningPlanEntry({ children }: { children: ReactNode }) {
  const { reload } = useAccount();
  const [params, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const selectedCourseIds = params.getAll("course");
  const courseSetup = params.get("setup") === "courses";
  const [saveError, setSaveError] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [courses, setCourses] = useState<Course[]>(() => courseSetup ? [...(cachedCourseDirectory()?.values() ?? [])] : []);
  const [referenceSkills, setReferenceSkills] = useState<WefSkill[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(() => Boolean(params.get("skill")) && !courseSetup);
  const [referenceError, setReferenceError] = useState("");
  const [selectedSkill] = useState(() => params.get("skill") ?? "");
  const [catalogueLoading, setCatalogueLoading] = useState(() => !courseSetup || !selectedCourseIds.every(id => cachedCourseDirectory()?.has(id)));
  const [catalogueError, setCatalogueError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const goalId = useRef(crypto.randomUUID());
  useEffect(() => {
    alive.current = true;
    const changed = () => setRevision(value => value + 1);
    window.addEventListener("workspace-change", changed);
    return () => { alive.current = false; window.removeEventListener("workspace-change", changed); };
  }, []);
  void revision;
  let complete = false;
  let stateError = "";
  try { complete = onboardingStatus() === "completed"; }
  catch (error) { stateError = error instanceof Error ? error.message : "Your saved setup could not be read."; }
  const targetSkill = resolveCatalogueSkill(courseSetup ? "" : selectedSkill, referenceSkills);
  const invalidSkill = Boolean(!courseSetup && selectedSkill && !referenceLoading && !targetSkill);
  useEffect(() => {
    if ((complete && !courseSetup) || stateError || courseSetup || !selectedSkill) return;
    let cancelled = false;
    void referenceService.wefSkills().then(rows => {
      if (!cancelled) { setReferenceSkills(rows); setReferenceLoading(false); setReferenceError(""); }
    }).catch(() => {
      if (!cancelled) { setReferenceLoading(false); setReferenceError("The skill reference could not be loaded. Retry before choosing linked courses."); }
    });
    return () => { cancelled = true; };
  }, [complete, courseSetup, stateError, selectedSkill, retry]);
  const targetSlug = targetSkill?.slug ?? null;
  useEffect(() => {
    if ((complete && !courseSetup) || stateError || (!courseSetup && referenceLoading)) return;
    // The Skill areas page already resolved these IDs. Reuse that catalogue
    // rather than making users wait for a duplicate fetch or unrelated skills.
    const cached = cachedCourseDirectory();
    if (courseSetup && retry === 0 && cached && params.getAll("course").every(id => cached.has(id))) {
      setCourses([...cached.values()]);
      setCatalogueLoading(false);
      setCatalogueError("");
      return;
    }
    let cancelled = false;
    setCatalogueLoading(true);
    const request = courseSetup || (targetSlug && !invalidSkill)
      ? loadLearningCatalogue(courseSetup ? null : targetSlug, retry > 0)
      : Promise.resolve({ courses: [] as Course[], notice: "" });
    void request.then(result => {
      if (!cancelled) { setCourses(result.courses); setCatalogueError(""); setCatalogueLoading(false); }
    }).catch(() => {
      if (!cancelled) { setCourses([]); setCatalogueLoading(false); setCatalogueError("Courses could not be loaded. Retry, or return to Skill areas to choose your courses."); }
    });
    return () => { cancelled = true; };
  }, [complete, courseSetup, stateError, referenceLoading, targetSlug, invalidSkill, retry, params]);

  if (complete && !courseSetup) return <>{children}</>;
  if (stateError) return <section className="learning-plan-onboarding lpo-state-error"><h1>Your learning setup needs attention</h1><p role="alert">{stateError}</p><button type="button" onClick={reload}>Reload saved account</button></section>;
  const buildPlan = async (inputs: LearningPlanInputs, resources: LearningPlanResource[]) => {
    if (referenceLoading || invalidSkill || catalogueLoading || catalogueError) throw new Error("Wait for the selected skill courses, retry, or clear the skill to build a practice-only plan.");
    if (lock.current || needsReload) throw new Error("Please wait or reload your saved account before continuing.");
    lock.current = true;
    const owner = currentWorkspaceSession();
    setBusy(true); setSaveError("");
    try {
      const records = createOnboardingRecords({ inputs, resources, courses, selectedCourseIds: courseSetup ? selectedCourseIds : undefined, selectedSkill: courseSetup ? null : selectedSkill || null, referenceSkills, goalId: goalId.current });
      await completeLearningOnboarding(records, courseSetup);
      if (!alive.current || owner !== currentWorkspaceSession()) return;
      setParams({ goal: records.goal.id }, { replace: true });
      setRevision(value => value + 1);
    } catch (error) {
      if (!alive.current || owner !== currentWorkspaceSession()) return;
      const message = onboardingSaveError(error);
      setSaveError(message);
      if (error instanceof ApiError && error.status === 409) setNeedsReload(true);
      throw new Error(message);
    } finally {
      lock.current = false;
      if (alive.current && owner === currentWorkspaceSession()) setBusy(false);
    }
  };
  return <section className="learning-plan-onboarding" aria-label="Build my learning plan">
    <header className="lpo-header"><span className="lpo-eyebrow"><BookOpen size={15} aria-hidden="true" /> My learning plan</span><h1>Goals &amp; activities</h1></header>
    <section className="lpo-card" aria-label="Make it yours">
      <h2>Make it yours</h2>
      {catalogueError && <div className="lpo-catalogue-notice"><p role="alert">{catalogueError}</p><button disabled={busy || catalogueLoading} type="button" onClick={() => { setCatalogueLoading(true); setRetry(value => value + 1); }}>Retry courses</button></div>}
      {referenceError && <p role="alert">{referenceError}</p>}
      {invalidSkill && <p role="alert">Return to Skill areas to choose a supported skill.</p>}
      <LearningPlanPreferences goalTitle={courses.filter(course => selectedCourseIds.includes(course.id)).map(course => course.title).join("; ").slice(0, 300) || targetSkill?.name || "My learning plan"} disabled={needsReload || invalidSkill || Boolean(catalogueError)} busy={busy} loading={catalogueLoading || referenceLoading} error={saveError} onSubmit={buildPlan} />
      {needsReload && <button type="button" onClick={reload}>Reload saved account</button>}
    </section>
    <p className="lpo-footnote">Your plan uses available catalogue courses and short practice activities, not AI-generated course content. You’ll review it before adding courses. This setup only appears until your first plan is saved.</p>
  </section>;
}

import { useEffect, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Sparkles } from "lucide-react";
import { useAccount } from "@/components/account/useAccount";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { ApiError } from "@/services/api";
import { onboardingSaveError } from "@/features/learning-onboarding/learningOnboardingErrors";
import { loadLearningCatalogue } from "@/features/learning-planning/courseDirectory";
import type { Course } from "@/features/learning-planning/types";
import type { LearningPlanInputs } from "@/features/learning-goals/personalLearningPlan";
import type { LearningPlanResource } from "@/features/learning-goals/learningPlanSetup";
import { completeLearningOnboarding, createOnboardingRecords, onboardingStatus, validateLearningRequest } from "@/features/learning-onboarding/learningOnboarding";
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
  const [, setParams] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const [step, setStep] = useState<"goal" | "preferences">("goal");
  const [goalText, setGoalText] = useState("");
  const [startedPreferences, setStartedPreferences] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
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
  useEffect(() => {
    if (complete || stateError) return;
    let cancelled = false;
    void loadLearningCatalogue(null, true).then(result => {
      if (!cancelled) { setCourses(result.courses); setCatalogueError(""); }
    }).catch(() => {
      if (!cancelled) { setCourses([]); setCatalogueError("The course catalogue is unavailable. You can still build a practice-only starting plan, or retry loading courses."); }
    }).finally(() => { if (!cancelled) setCatalogueLoading(false); });
    return () => { cancelled = true; };
  }, [complete, stateError, retry]);

  if (complete) return <>{children}</>;
  if (stateError) return <section className="learning-plan-onboarding lpo-state-error"><h1>Your learning setup needs attention</h1><p role="alert">{stateError}</p><button type="button" onClick={reload}>Reload saved account</button></section>;
  const continueToPreferences = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateLearningRequest(goalText);
    setGoalError(error);
    if (!error) { setGoalText(goalText.trim()); setStartedPreferences(true); setStep("preferences"); }
  };
  const buildPlan = async (inputs: LearningPlanInputs, resources: LearningPlanResource[]) => {
    if (lock.current || needsReload) throw new Error("Please wait or reload your saved account before continuing.");
    lock.current = true;
    const owner = currentWorkspaceSession();
    setBusy(true); setSaveError("");
    try {
      const records = createOnboardingRecords({ inputs, resources, courses, goalId: goalId.current });
      await completeLearningOnboarding(records);
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
    <header className="lpo-header"><span className="lpo-eyebrow"><BookOpen size={15} aria-hidden="true" /> My learning plan</span><h1>Build a plan around you.</h1><p>Tell us what you want to learn. We’ll help you turn it into a manageable next step.</p></header>
    <ol className="lpo-steps" aria-label="Learning setup progress"><li aria-current={step === "goal" ? "step" : undefined}><span>{step === "preferences" ? <Check size={14} aria-hidden="true" /> : "1"}</span>Your goal</li><li aria-current={step === "preferences" ? "step" : undefined}><span>2</span>Make it yours</li></ol>
    <section className="lpo-card">
      <div hidden={step !== "goal"}><div className="lpo-icon"><Sparkles size={23} aria-hidden="true" /></div><h2>What would you like to learn?</h2><p className="lpo-description">A skill, a topic, or something you’d like to do better. Start with your own words.</p>
        <form onSubmit={continueToPreferences}>
          <label htmlFor="onboarding-learning-goal">My learning goal</label><textarea id="onboarding-learning-goal" rows={3} maxLength={300} value={goalText} autoFocus placeholder="For example, I want to use AI more confidently in my daily work" onChange={event => { setGoalText(event.target.value); setGoalError(""); }} aria-describedby="onboarding-goal-hint" />
          <div className="lpo-input-footer"><span id="onboarding-goal-hint">{goalText.length}/300 · No perfect wording needed.</span></div>
          <p className="lpo-example-label">Need a starting point?</p><div className="lpo-examples">{["Use AI confidently at work", "Make clearer reports with Excel", "Improve my communication skills"].map(example => <button type="button" key={example} onClick={() => { setGoalText(example); setGoalError(""); }}>{example}</button>)}</div>
          {goalError && <p className="lpo-error" role="alert">{goalError}</p>}
          <div className="lpo-goal-footer"><button className="lpo-primary" disabled={Boolean(validateLearningRequest(goalText))} type="submit">Continue <ArrowRight size={17} aria-hidden="true" /></button><span>Next: your starting level and daily learning time.</span></div>
        </form>
      </div>
      {startedPreferences && <div hidden={step !== "preferences"}>
        <h2>Let’s make it fit your day.</h2>
        {catalogueError && <div className="lpo-catalogue-notice"><p role="status">{catalogueError}</p><button disabled={busy || catalogueLoading} type="button" onClick={() => { setCatalogueLoading(true); setRetry(value => value + 1); }}>Retry courses</button></div>}
        <LearningPlanPreferences goalTitle={goalText} disabled={needsReload} busy={busy} loading={catalogueLoading} error={saveError} onSubmit={buildPlan} onCancel={() => setStep("goal")} onGoalTextChange={setGoalText} />
        {needsReload && <button type="button" onClick={reload}>Reload saved account</button>}
      </div>}
    </section>
    <p className="lpo-footnote">Your plan uses available catalogue courses and short practice activities, not AI-generated course content. You’ll review it before adding courses. This setup only appears until your first plan is saved.</p>
  </section>;
}

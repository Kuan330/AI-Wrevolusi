import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { ROUTES } from "@/constants/routes";
import { readJourneyProfile } from "@/features/journey/journey";
import { checkWorkAiFindings } from "@/features/work-profile/checkWorkAiFindings";
import ExposureTaskList from "./components/ExposureTaskList";
import AssistanceChart from "@/components/dashboard/AssistanceChart";
import { currentAssessments, type AssistanceCategory } from "@/features/ai-impact/assistance";
import { Card } from "@/components/ui/card";
import "./exposure.css";

export default function AIExposure() {
  const [, refresh] = useState(0);
  const [category, setCategory] = useState<AssistanceCategory>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const pending = useRef(false);
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    const update = () => refresh(value => value + 1);
    window.addEventListener("workspace-change", update);
    return () => { mounted.current = false; window.removeEventListener("workspace-change", update); };
  }, []);
  let profile: ReturnType<typeof readJourneyProfile> | null = null;
  let readError = "";
  try { profile = readJourneyProfile(); }
  catch (issue) { readError = issue instanceof Error ? issue.message : "Your saved work could not be read."; }
  const checkResearch = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    const owner = currentWorkspaceSession();
    setChecking(true); setError("");
    try { await checkWorkAiFindings(); }
    catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Research could not be loaded. Try again."); }
    finally { pending.current = false; if (mounted.current) { setChecking(false); refresh(value => value + 1); } }
  }, []);
  const analysis = profile?.analysis?.classificationCheck === "same-title-v1" ? profile.analysis : null;
  const assessments = profile ? currentAssessments(profile) : [];
  const complete = Boolean(analysis && profile && assessments.length === profile.tasks.length);
  const checkKey = JSON.stringify([currentWorkspaceSession(), profile?.profileVersion, profile?.tasksOccupationCode, profile?.tasks]);
  const canCheck = Boolean(profile?.tasksConfirmed && profile.tasks.length && profile.tasksOccupationCode && !readError);
  useEffect(() => {
    if (!canCheck || complete || pending.current || attempted.current.has(checkKey)) return;
    attempted.current.add(checkKey);
    void checkResearch();
  }, [canCheck, complete, checkKey, checkResearch, checking]);

  return <div className="exposure-page w-full">
    <PageHeader className="exposure-page__header flex-col items-start sm:flex-row sm:items-center" title="AI impact & assistance"
      description="Choose a task. See what AI might help with, what you need to check, and a useful next step."
      actions={<Button asChild variant="outline"><Link to={ROUTES.workProfile}>Review my tasks</Link></Button>} />
    {readError ? <div role="alert" className="exposure-notice"><p>{readError}</p><Link to={ROUTES.continue}>Review recovery options</Link></div> : profile && <>
      {(!complete || error || checking) && <section className="exposure-notice" aria-label="Research status">
        <h2>{error ? "The research check needs attention" : profile.tasksOccupationCode ? "Checking your tasks automatically" : "Your work has no research occupation linked yet"}</h2>
        {profile.analysis && !analysis && <p>These older findings need an occupation-link check before we show their source values. Your tasks and saved work are kept.</p>}
        <p>{profile.tasksOccupationCode ? "We are checking research connections for each confirmed task. Results appear here when ready." : "We cannot look up occupation research yet. You can still explore skills from the tasks you confirmed."}</p>
        {profile.tasksOccupationCode && error && <Button disabled={checking} onClick={() => void checkResearch()}>{checking ? "Checking research…" : error ? "Retry research check" : "Check research"}</Button>}
        {error && <p role="alert">{error} Your work is still saved. A failed request does not mean there is no research.</p>}
      </section>}
      <div className="exposure-epic-layout">
      <Card className="exposure-overview"><h2>Tasks by AI assistance</h2><p className="exposure-section-hint">See how AI may support your work. Click a segment or category to filter tasks; click it again to clear.</p>{(checking || error || !analysis) && <p className="exposure-caption" role="status">{checking ? "Checking research…" : error ? "Research unavailable. Tasks are shown as Unverified until the check succeeds." : "Tasks remain Unverified while research connections are checked."}</p>}<AssistanceChart tasks={profile.tasks} assessments={checking || error ? [] : assessments} showUnverifiedBar selectedCategory={category} onCategoryChange={setCategory} /></Card>
      <ExposureTaskList category={category} sortByExposure occupation={analysis ? {title: analysis.occupationTitle, code: analysis.occupationCode} : undefined} tasks={profile.tasks} assessments={checking || error ? [] : assessments}
        researchChecked={Boolean(analysis) && !checking} researchLoading={checking} researchUnavailable={Boolean(error)} />
      </div>

    </>}
  </div>;
}

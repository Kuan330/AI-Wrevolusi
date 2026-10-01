import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { readJourneyProfile } from "@/features/journey/journey";
import { checkWorkAiFindings } from "@/features/work-profile/checkWorkAiFindings";
import ExposureTaskList from "./components/ExposureTaskList";
import AssistanceChart from "@/components/dashboard/AssistanceChart";
import { currentAssessments } from "@/features/ai-impact/assistance";
import { Card } from "@/components/ui/card";
import "./exposure.css";

export default function AIExposure() {
  const [, refresh] = useState(0);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
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
  async function checkResearch() {
    if (checking) return;
    setChecking(true); setError("");
    try { await checkWorkAiFindings(); }
    catch (issue) { if (mounted.current) setError(issue instanceof Error ? issue.message : "Research could not be loaded. Try again."); }
    finally { if (mounted.current) { setChecking(false); refresh(value => value + 1); } }
  }
  const analysis = profile?.analysis?.classificationCheck === "same-title-v1" ? profile.analysis : null;
  const assessments = profile ? currentAssessments(profile) : [];
  return <div className="exposure-page w-full">
    <PageHeader className="exposure-page__header flex-col items-start sm:flex-row sm:items-center" title="AI impact & assistance"
      description="Choose a task. See what AI might help with, what you need to check, and a useful next step."
      actions={<Button asChild variant="outline"><Link to={ROUTES.task}>Review my tasks</Link></Button>} />
    {readError ? <div role="alert" className="exposure-notice"><p>{readError}</p><Link to={ROUTES.continue}>Review recovery options</Link></div> : profile && <>
      {(!analysis || error || checking) && <section className="exposure-notice" aria-label="Research status">
        <h2>{error ? "The research check needs attention" : profile.tasksOccupationCode ? "Check the research when you are ready" : "Your work has no research occupation linked yet"}</h2>
        {profile.analysis && !analysis && <p>These older findings need an occupation-link check before we show their source values. Your tasks and saved work are kept.</p>}
        <p>{profile.tasksOccupationCode ? "Your tasks are saved. You can check for research connections or explore your skills now." : "We cannot look up occupation research yet. You can still explore skills from the tasks you confirmed."}</p>
        {profile.tasksOccupationCode && <Button disabled={checking} onClick={() => void checkResearch()}>{checking ? "Checking research…" : error ? "Retry research check" : "Check research"}</Button>}
        {error && <p role="alert">{error} Your work is still saved. A failed request does not mean there is no research.</p>}
      </section>}
      <div className="exposure-epic-layout">
      <Card className="exposure-overview"><h2>Tasks by AI assistance category</h2><p className="exposure-caption">{profile.tasks.length} confirmed tasks</p>{(checking || error || !analysis) && <p className="exposure-caption" role="status">{checking ? "Checking research…" : error ? "Research unavailable. Tasks are shown as Unverified until the check succeeds." : "Tasks are shown as Unverified until you check the research."}</p>}<AssistanceChart tasks={profile.tasks} assessments={checking || error ? [] : assessments} showUnverifiedBar /></Card>
      <ExposureTaskList occupation={analysis ? {title: analysis.occupationTitle, code: analysis.occupationCode} : undefined} tasks={profile.tasks} assessments={assessments}
        researchChecked={Boolean(analysis) && !checking} researchLoading={checking} researchUnavailable={Boolean(error)} />
      </div>
      <aside className="exposure-progress">
        <details><summary>How can I review progress?</summary><p>Build a skill, try an activity and review your saved records in <Link to={ROUTES.progress}>My progress</Link>. Learning does not lower the published research score.</p><p>Compare similar work: what was correct, what needed fixing, and how long it took. Completing a course alone does not prove that your skills improved.</p><a href="https://www.ilo.org/publications/workers%E2%80%99-exposure-ai-what-indicators-tell-us-%E2%80%93-and-what-they-don%E2%80%99t" target="_blank" rel="noreferrer">ILO: what exposure indicators can tell us</a></details>
      </aside>
    </>}
  </div>;
}

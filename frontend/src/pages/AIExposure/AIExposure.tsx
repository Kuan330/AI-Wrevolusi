import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { readJourneyProfile } from "@/features/journey/journey";
import { checkWorkAiFindings } from "@/features/work-profile/checkWorkAiFindings";
import ExposureTaskList from "./components/ExposureTaskList";
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
  return <div className="exposure-page mx-auto w-full max-w-[1200px]">
    <PageHeader className="flex-col items-start sm:flex-row sm:items-center" title="Where could AI change my work?"
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
      <ExposureTaskList occupation={analysis ? {title: analysis.occupationTitle, code: analysis.occupationCode} : undefined} tasks={profile.tasks} assessments={(analysis?.taskExposureAssessments ?? []).filter(item => profile.tasks.some(task => task.id === item.task_id && analysis?.tasks.some(saved => saved.id === task.id && saved.wording === task.wording)))}
        researchChecked={Boolean(analysis) && !checking} researchLoading={checking} researchUnavailable={Boolean(error)} />
      <aside className="exposure-progress">
        <h2>Progress means better work</h2>
        <p>Build a skill, practise it, and review a real example. Learning does not lower the published research score.</p>
        <details><summary>How could I check my progress?</summary><p>Compare similar work: what was correct, what needed fixing, and how long it took. Completing a course alone does not prove that your skills improved.</p><p>The research describes technical potential. It does not predict job loss, time saved, or whether your workplace will adopt AI.</p><a href="https://www.ilo.org/publications/workers%E2%80%99-exposure-ai-what-indicators-tell-us-%E2%80%93-and-what-they-don%E2%80%99t" target="_blank" rel="noreferrer">ILO: what exposure indicators can tell us</a></details>
      </aside>
    </>}
  </div>;
}

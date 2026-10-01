import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { ProfileTask } from "@/features/work-profile/types";
import { taskSourceLabel } from "@/features/work-profile/taskSourceLabel";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { TaskAssistAccess } from "@/pages/Analysis/components/TaskDetailsDrawer";
import { taskGuidance } from "../lib/taskGuidance";
import { taskResearch } from "../../../features/ai-impact/taskResearch.ts";
import { assistanceForTask } from "@/features/ai-impact/assistance";
import { ILO_OCCUPATION_EXPOSURE_SOURCE } from "@/pages/Analysis/lib/dataSources";
import { cleanDisplayText, shortTaskLabel } from "@/lib/displayText";

export default function TaskImpact({ task, assessment, researchChecked, researchLoading = false, researchUnavailable, occupation }: {
  task: ProfileTask; assessment?: ConfirmedTaskExposureAssessment; researchChecked: boolean; researchLoading?: boolean; researchUnavailable: boolean; occupation?: { title: string; code: string };
}) {
  const research = taskResearch(task, assessment);
  const guidance = taskGuidance(task);
  const [showAi, setShowAi] = useState(false);
  const status = researchLoading ? "Checking research…" : researchUnavailable ? "Research unavailable" : !researchChecked ? "Research not checked" : assistanceForTask(task, assessment).label;
  const published = research.kind === "linked" && researchChecked && !researchUnavailable && !researchLoading ? research.references[0] : null;
  const label = shortTaskLabel(task.wording, 65);
  return <article className="exposure-task-impact" aria-label="Selected task">
    <div className="exposure-interpretation"><section className="exposure-question"><h3>AI can assist with</h3>
      <p>{guidance.help}</p>

    </section>
    <section className="exposure-question"><h3>Your judgement matters</h3><p>{guidance.review}</p></section></div>
    <section className="exposure-question exposure-next">
      <Button asChild><Link to={`${ROUTES.skills}?view=task&task=${encodeURIComponent(task.id)}`} state={{ taskWording: task.wording }}>Explore skills for this task →</Link></Button>
    </section>
    <details className="exposure-evidence"><summary>View research basis</summary>
    <p className="exposure-evidence-label">{status}</p>
    <h2>{label}</h2>
    {label !== cleanDisplayText(task.wording) && <details className="exposure-full-task"><summary>Read the full task</summary><p>{cleanDisplayText(task.wording)}</p>{task.notes && <p>Working context: {cleanDisplayText(task.notes)}</p>}</details>}
    <p className="exposure-task-source">{taskSourceLabel(task)}</p>
    {published && <section className="exposure-source-scale" aria-label="Published research estimate">
      <h3>ILO {assessment?.source_year || "2025"} source estimate <strong>{published.score_2025}</strong> <small>out of 1</small></h3>
      <meter min={0} max={1} value={published.score_2025} aria-label={`ILO ${assessment?.source_year || "2025"} reference task estimate`} aria-valuetext={`${published.score_2025} out of 1, technical automation potential for the reference task`} />
      <div className="exposure-scale-ends"><span>0 · Lower technical potential</span><span>1 · Higher technical potential</span></div>
      <p>Estimated potential for generative AI to automate this reference task under the study’s assumptions. This is not your chance of losing a job or time saved.</p>
    </section>}
      {(research.kind !== "linked" || !researchChecked || researchUnavailable) && <p className="exposure-evidence-note">{researchLoading ? "Checking source connections and saving the result. You can still explore skills." : researchUnavailable ? "The research request failed. We cannot show a new finding yet." : !researchChecked ? "Research has not been checked for this work yet." : research.kind === "candidate" ? "Related research was found, but the task match needs checking. We have not assigned its score to your work." : "There is no supported research match here. This does not mean zero exposure or no useful skills."}</p>}
      {occupation && <p><strong>Research occupation:</strong> {occupation.title} · {occupation.code}. This reference may not cover every part of your job.</p>}
      {task.sourceVersion && <p className="exposure-caption">Saved reference version: {task.sourceVersion}</p>}
      <p>Practical ideas above use simple task-wording rules. Research below is a separate source of evidence.</p>
      {!researchChecked || researchUnavailable || research.kind === "gap" ? <p>No source score is shown for this task. We have not filled the gap with a zero or an AI-generated prediction.</p> : <>
        <p>{research.kind === "linked" ? "Your wording matches the linked ILO reference task. This is a text and reference-ID match, not a workplace validation." : `The system suggested related tasks using ${assessment?.match_layer === "llm" ? "an AI model" : "text similarity"}. A possible match is not proof that the source describes your work.`}</p>
        <p><strong>ILO research · {assessment?.source_year || "2025"}</strong></p>
        {research.references.map(reference => <div className="exposure-reference" key={reference.ilo_task_id}>
          <h4>{research.kind === "candidate" ? "Possible reference task" : "Reference task"} · {reference.ilo_task_id}</h4><p>{cleanDisplayText(reference.task_text)}</p>
          {research.kind === "linked" && <p><strong>{reference.score_2025} on a 0–1 scale</strong> · source estimate for this reference task</p>}
          <p className="exposure-caption">Source method: {reference.source_method || "Not recorded"}. This describes how the source produced the value, not how your task was matched.</p>
        </div>)}
        {research.kind === "candidate" && <p><strong>No score is shown while the match is uncertain.</strong> Your task stays available for skill review.</p>}
        <p>Higher values mean more estimated technical automation potential with generative AI under the study’s assumptions. Zero and one are the ends of that research scale.</p>
        <p><strong>This is not a probability of job loss, a percentage of time saved, or a score of your ability.</strong> It does not measure robotics or confirm what a tool can safely do at your workplace.</p>
        <p className="exposure-caption">Only a direct reference link shows a source value. We do not show the app’s adjusted or averaged scores.</p>
      </>}
      <p><a href={ILO_OCCUPATION_EXPOSURE_SOURCE.href} target="_blank" rel="noreferrer">Read the ILO 2025 study</a> · <a href="https://www.ilo.org/resource/article/how-might-generative-ai-impact-different-occupations" target="_blank" rel="noreferrer">How to read the scale</a></p>
      <p>If the task wording no longer fits your work, <Link to={ROUTES.workProfile}>review your task</Link>. Editing your work clears the old analysis; it does not validate a new research match.</p>
      <details onToggle={event => setShowAi(event.currentTarget.open)}><summary>Optional AI guidance</summary><p>An AI response can suggest ideas. It cannot validate the research match or predict your personal outcome. Guidance is available when you are signed in.</p>{showAi && <div className="exposure-ai-help"><TaskAssistAccess task={task} inline /></div>}</details>
    </details>
  </article>;
}

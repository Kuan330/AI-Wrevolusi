import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { ProfileTask } from "@/features/work-profile/types";
import { taskSourceLabel } from "@/features/work-profile/taskSourceLabel";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { TaskAssistAccess } from "@/pages/Analysis/components/TaskDetailsDrawer";
import { taskGuidance } from "../lib/taskGuidance";
import { taskResearch } from "../lib/taskResearch";
import { ILO_OCCUPATION_EXPOSURE_SOURCE } from "@/pages/Analysis/lib/dataSources";

export default function TaskImpact({ task, assessment, researchChecked, researchLoading = false, researchUnavailable, occupation }: {
  task: ProfileTask; assessment?: ConfirmedTaskExposureAssessment; researchChecked: boolean; researchLoading?: boolean; researchUnavailable: boolean; occupation?: { title: string; code: string };
}) {
  const research = taskResearch(task, assessment);
  const guidance = taskGuidance(task);
  const [showAi, setShowAi] = useState(false);
  const status = researchLoading ? "Checking research…" : researchUnavailable ? "Research unavailable" : !researchChecked ? "Research not checked" : research.label;
  return <article className="exposure-task-impact" aria-label="Selected task">
    <p className="exposure-evidence-label">{status}</p>
    <h2>{task.wording}</h2>
    <p className="exposure-task-source">{taskSourceLabel(task)}</p>
    <section className="exposure-question"><h3>1. What could change?</h3>
      <p>{guidance.help}</p>
      <p className="exposure-caption">An idea based on your task wording, not a research finding or a tested benefit.</p>
      {(research.kind !== "linked" || !researchChecked || researchUnavailable) && <p className="exposure-evidence-note">{researchLoading ? "Checking source connections and saving the result. You can still explore skills." : researchUnavailable ? "The research request failed. We cannot show a new finding yet." : !researchChecked ? "Research has not been checked for this work yet." : research.kind === "candidate" ? "Related research was found, but the task match needs checking. We have not assigned its score to your work." : "There is no supported research match here. This does not mean zero exposure or no useful skills."}</p>}
    </section>
    <section className="exposure-question"><h3>2. What still needs my judgement?</h3><p>{guidance.review}</p><p className="exposure-caption">Use approved workplace procedures. A research score does not show that a task is safe to automate.</p></section>
    <section className="exposure-question"><h3>3. What can I do next?</h3><p>Review the skills used in this task. Then choose one to develop and practise.</p>
      <Button asChild><Link to={`${ROUTES.skills}?task=${encodeURIComponent(task.id)}`} state={{ taskWording: task.wording }}>Explore skills for this task →</Link></Button>
      <p className="exposure-caption">Your task stays with you. Missing research does not block this step.</p>
    </section>
    <details className="exposure-evidence"><summary>Why are we showing this?</summary>
      {occupation && <p><strong>Research occupation:</strong> {occupation.title} · {occupation.code}. This reference may not cover every part of your job.</p>}
      {task.sourceVersion && <p className="exposure-caption">Saved reference version: {task.sourceVersion}</p>}
      <p>Practical ideas above use simple task-wording rules. Research below is a separate source of evidence.</p>
      {!researchChecked || researchUnavailable || research.kind === "gap" ? <p>No source score is shown for this task. We have not filled the gap with a zero or an AI-generated prediction.</p> : <>
        <p>{research.kind === "linked" ? "Your wording matches the linked ILO reference task. This is a text and reference-ID match, not a workplace validation." : `The system suggested related tasks using ${assessment?.match_layer === "llm" ? "an AI model" : "text similarity"}. A possible match is not proof that the source describes your work.`}</p>
        <p><strong>ILO research · {assessment?.source_year || "2025"}</strong></p>
        {research.references.map(reference => <div className="exposure-reference" key={reference.ilo_task_id}>
          <h4>{research.kind === "candidate" ? "Possible reference task" : "Reference task"} · {reference.ilo_task_id}</h4><p>{reference.task_text}</p>
          {research.kind === "linked" && <p><strong>{reference.score_2025} on a 0–1 scale</strong> · source estimate for this reference task</p>}
          <p className="exposure-caption">Source method: {reference.source_method || "Not recorded"}. This describes how the source produced the value, not how your task was matched.</p>
        </div>)}
        {research.kind === "candidate" && <p><strong>No score is shown while the match is uncertain.</strong> Your task stays available for skill review.</p>}
        <p>Higher values mean more estimated technical automation potential with generative AI under the study’s assumptions. Zero and one are the ends of that research scale.</p>
        <p><strong>This is not a probability of job loss, a percentage of time saved, or a score of your ability.</strong> It does not measure robotics or confirm what a tool can safely do at your workplace.</p>
        <p className="exposure-caption">Only a direct reference link shows a source value. We do not show the app’s adjusted or averaged scores.</p>
      </>}
      <p><a href={ILO_OCCUPATION_EXPOSURE_SOURCE.href} target="_blank" rel="noreferrer">Read the ILO 2025 study</a> · <a href="https://www.ilo.org/resource/article/how-might-generative-ai-impact-different-occupations" target="_blank" rel="noreferrer">How to read the scale</a></p>
      <p>If the task wording no longer fits your work, <Link to={ROUTES.task}>review your task</Link>. Editing your work clears the old analysis; it does not validate a new research match.</p>
      <details onToggle={event => setShowAi(event.currentTarget.open)}><summary>Optional AI guidance</summary><p>An AI response can suggest ideas. It cannot validate the research match or predict your personal outcome. Guidance is available when you are signed in.</p>{showAi && <div className="exposure-ai-help"><TaskAssistAccess task={task} inline /></div>}</details>
    </details>
  </article>;
}

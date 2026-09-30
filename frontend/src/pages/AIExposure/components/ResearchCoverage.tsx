import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { taskResearch } from "../lib/taskResearch";

export default function ResearchCoverage({ tasks, assessments }: { tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[] }) {
  const counts = { linked: 0, candidate: 0, gap: 0 };
  for (const task of tasks) counts[taskResearch(task, assessments.find(item => item.task_id === task.id)).kind]++;
  const groups = [["linked", "Direct research links"], ["candidate", "Possible links to check"], ["gap", "No supported link"]] as const;
  return <section className="exposure-coverage" aria-label="Research coverage">
    <h2>Research for your {tasks.length} {tasks.length === 1 ? "task" : "tasks"}</h2>
    <div className="exposure-coverage__bar" aria-hidden="true">{groups.map(([key]) => counts[key] > 0 && <span key={key} className={`coverage-${key}`} style={{ flex: counts[key] }} />)}</div>
    <ul>{groups.map(([key, label]) => <li key={key}><span className={`coverage-dot coverage-${key}`} aria-hidden="true" /><strong>{counts[key]}</strong> {label}</li>)}</ul>
    <p>These counts show where research connects to your wording. They do not measure how much of your job will change.</p>
  </section>;
}

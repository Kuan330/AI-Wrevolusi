import { assistanceOverview } from "@/features/ai-impact/assistance";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

export default function AssistanceChart({ tasks, assessments }: { tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[] }) {
  const { groups, unverified } = assistanceOverview(tasks, assessments);
  const max = Math.max(1, tasks.length);
  return <div className="assistance-chart">
    <dl>{groups.map(group => <div className="assistance-chart-row" key={group.category}><dt>{group.label}</dt><dd><span className="assistance-chart-track" aria-hidden="true"><span className={`assistance-fill assistance-${group.category}`} style={{ width: `${group.count / max * 100}%` }} /></span><strong>{group.count}<span className="sr-only"> tasks</span></strong></dd></div>)}</dl>
    <p className="assistance-unverified"><span className="assistance-dot" /> <strong>{unverified}</strong> Unverified <span>· no supported data match</span></p>
    <p className="exposure-caption">Bars show the share of all tasks, ordered by task count. These categories are not a prediction about your job.</p>
    <details className="assistance-method"><summary>How these categories are shown</summary><p>Suggested assistance categories use directly linked research values: below 0.25, 0.25–0.55, and 0.55 or above. Possible matches and missing evidence remain Unverified. These are a planning guide, not measured automation rates or a prediction about your job.</p></details>
  </div>;
}

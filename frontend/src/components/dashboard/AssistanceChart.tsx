import { assistanceOverview } from "@/features/ai-impact/assistance";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

export default function AssistanceChart({ tasks, assessments, showUnverifiedBar = false }: { tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[]; showUnverifiedBar?: boolean }) {
  const { groups, unverified } = assistanceOverview(tasks, assessments);
  const max = Math.max(1, tasks.length);
  const rows = showUnverifiedBar ? [...groups, { category: "unverified" as const, label: "Unverified", count: unverified }] : groups;
  return <div className="assistance-chart">
    <dl>{rows.map(row => <div className="assistance-chart-row" key={row.category}><dt>{row.label}</dt><dd><span className="assistance-chart-track" aria-hidden="true"><span className={`assistance-fill ${row.category === "unverified" ? "assistance-unverified-fill" : `assistance-${row.category}`}`} style={{ width: `${row.count / max * 100}%` }} /></span><strong>{row.count}<span className="sr-only"> tasks</span></strong></dd></div>)}</dl>
    {!showUnverifiedBar && <p className="assistance-unverified"><span className="assistance-dot" /> <strong>{unverified}</strong> Unverified <span>· no supported data match</span></p>}
    <p className="exposure-caption">Unverified is a source-evidence gap, not zero exposure. Bars show the share of all tasks and are not a prediction about your job.</p>
    <details className="assistance-method"><summary>How these categories are shown</summary><p>Suggested assistance categories use directly linked research values: below 0.25, 0.25–0.55, and 0.55 or above. Possible matches and missing evidence remain Unverified. These are a planning guide, not measured automation rates or a prediction about your job.</p></details>
  </div>;
}

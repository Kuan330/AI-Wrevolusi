import { useId } from "react";
import { assistanceOverview, type AssistanceCategory } from "@/features/ai-impact/assistance";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

export default function AssistanceChart({ tasks, assessments, showUnverifiedBar = false, selectedCategory, onCategoryChange }: { tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[]; showUnverifiedBar?: boolean; selectedCategory?: AssistanceCategory; onCategoryChange?: (category: AssistanceCategory | undefined) => void }) {
  const { groups, unverified } = assistanceOverview(tasks, assessments);
  const max = Math.max(1, tasks.length);
  const patternId = useId().replace(/:/g, "");
  const rows = showUnverifiedBar ? [...groups, { category: "unverified" as const, label: "Unverified", count: unverified }] : groups;
  const toggleCategory = (category: AssistanceCategory) => onCategoryChange?.(selectedCategory === category ? undefined : category);
  return <div className="assistance-chart">
    {onCategoryChange ? <div className="assistance-donut-chart">
      <div className="assistance-donut">
        <svg viewBox="0 0 220 220" role="group" aria-label="Task distribution. Select a segment to filter tasks.">
          <defs><pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e2e8f0" /><rect width="3" height="6" fill="#98a5b8" /></pattern></defs>
          <circle cx="110" cy="110" r="88" fill="none" stroke="#edf1f6" strokeWidth="17" />
          {rows.map((row, index) => {
            if (!row.count) return null;
            const share = row.count / max * 100;
            const offset = rows.slice(0, index).reduce((sum, item) => sum + item.count, 0) / max * 100;
            const gap = rows.filter(item => item.count > 0).length > 1 ? Math.min(0.8, share / 4) : 0;
            return <circle key={row.category} className="assistance-donut-segment" role="button" tabIndex={0}
              aria-label={`${row.label}: ${row.count} tasks`} aria-pressed={selectedCategory === row.category}
              onClick={() => toggleCategory(row.category)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleCategory(row.category); }
                if (event.key === "Escape") onCategoryChange(undefined);
              }} cx="110" cy="110" r="88" pathLength="100" fill="none" strokeWidth="17"
              stroke={row.category === "unverified" ? `url(#${patternId})` : ({ high: "#4c83d1", partial: "#cf7caa", human: "#48a99a" }[row.category])}
              strokeDasharray={`${share - gap} ${100 - share + gap}`} strokeDashoffset={-offset} transform="rotate(-90 110 110)"
              opacity={selectedCategory && selectedCategory !== row.category ? 0.35 : 1} />;
          })}
        </svg>
        <div className="assistance-donut-total" aria-hidden="true"><strong>{tasks.length}</strong><span>{tasks.length === 1 ? "task" : "tasks"}</span></div>
      </div>
      <div className="assistance-donut-legend" aria-label="Filter tasks by AI assistance">
        {rows.map(row => <button type="button" key={row.category} aria-label={`${row.label} ${row.count}`} aria-pressed={selectedCategory === row.category}
          onClick={() => toggleCategory(row.category)}
          onKeyDown={event => { if (event.key === "Escape") onCategoryChange(undefined); }}
          className={`assistance-category-button assistance-donut-option filter-${row.category}`}>
          <span className={`assistance-donut-swatch assistance-${row.category === "unverified" ? "unverified-fill" : row.category}`} aria-hidden="true" />
          <span>{row.label}</span><strong>{row.count}</strong>
        </button>)}
      </div>
    </div> : <dl>{rows.map(row => <div className="assistance-chart-row" key={row.category}><dt>{row.label}</dt><dd><span className="assistance-chart-track" aria-hidden="true"><span className={`assistance-fill ${row.category === "unverified" ? "assistance-unverified-fill" : `assistance-${row.category}`}`} style={{ width: `${row.count / max * 100}%` }} /></span><strong>{row.count}<span className="sr-only"> tasks</span></strong></dd></div>)}</dl>}
    {!showUnverifiedBar && <p className="assistance-unverified"><span className="assistance-dot" /> <strong>{unverified}</strong> Unverified <span>· no supported data match</span></p>}

    <details className="assistance-method"><summary>How these categories are shown</summary><p>Suggested assistance categories use directly linked research values: below 0.25, 0.25–0.55, and 0.55 or above. Possible matches and missing evidence remain Unverified. These are a planning guide, not measured automation rates or a prediction about your job.</p></details>
  </div>;
}

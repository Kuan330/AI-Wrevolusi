import { Card } from "@/components/ui/card";
import type { TaskOverview } from "../lib/taskOverview";
import type { TaskScoreRange } from "@/pages/Analysis/lib/taskScore";

export default function PersonalTaskOverview({ overview, range }: { overview: TaskOverview; range: TaskScoreRange }) {
  return (
    <Card className="analysis-card personal-overview">
      <p className="exposure-eyebrow">Your confirmed tasks</p>
      <h2 className="exposure-title">Your task exposure at a glance</h2>
      <dl className="personal-overview__metrics">
        <div><dt>Tasks with scores</dt><dd>{overview.scored.length}</dd></div>
        <div><dt>Your task mean</dt><dd>{overview.mean?.toFixed(2) ?? "—"}<small> / 1.0</small></dd></div>
        <div><dt>In selected range</dt><dd>{overview.percentage === null ? "—" : `${overview.percentage}%`}</dd></div>
      </dl>
      <p className="exposure-caption" aria-live="polite">
        {overview.inRange} of {overview.scored.length} scored tasks fall between {range[0].toFixed(2)} and {range[1].toFixed(2)}.
        {overview.missingCount > 0 && ` ${overview.missingCount} tasks have no score and are excluded.`}
      </p>
      <p className="personal-overview__note">Each scored task counts equally. This is a share of tasks, not working time or the probability your job will be replaced.</p>
    </Card>
  );
}

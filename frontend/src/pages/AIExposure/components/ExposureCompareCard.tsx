import { Button } from "@/components/ui/button";
import { ILO_OCCUPATION_EXPOSURE_OPEN_DATA, ILO_OCCUPATION_EXPOSURE_SOURCE } from "@/pages/Analysis/lib/dataSources";
import type { ExposureCompareInsight } from "../lib/exposureCompare";

type Props = {
  occupationTitle: string;
  insight: ExposureCompareInsight;
  onOpenDetails: () => void;
  onViewTasks: () => void;
};
const scoreLabel = (score: number | null) => score == null ? "Not available" : `${Math.round(score * 100)} out of 100`;

export default function ExposureCompareCard({ occupationTitle, insight, onOpenDetails, onViewTasks }: Props) {
  const total = insight.scoredCount + insight.missingCount;
  return <section className="exposure-glass-card p-5 sm:p-6" aria-labelledby="ai-findings-summary">
    <p className="text-sm text-muted-foreground">{occupationTitle}</p>
    <h2 id="ai-findings-summary" className="mt-2 text-xl font-semibold">
      {insight.scoredCount ? "Start by reviewing one task" : "We need more evidence for these tasks"}
    </h2>
    <p className="mt-3 max-w-prose text-sm leading-6">
      {insight.scoredCount
        ? `We have research scores for ${insight.scoredCount} of your ${total} tasks. Use the task list below to see where generative AI may affect your work.`
        : "Your tasks are saved, but we cannot give them reliable research scores yet. You can still review your tasks and skills."}
    </p>
    {insight.missingCount > 0 && insight.scoredCount > 0 && <p className="mt-2 text-sm text-muted-foreground">
      {insight.missingCount} {insight.missingCount === 1 ? "task has" : "tasks have"} no reliable score. This does not mean AI has no effect.
    </p>}
    <Button className="mt-4 rounded-full" onClick={onViewTasks}>Review my tasks</Button>
    <details className="mt-5 border-t border-white/80 pt-3">
      <summary className="cursor-pointer py-2 text-sm font-medium text-primary">How to read the scores</summary>
      <div className="mt-2 space-y-3 text-sm leading-6">
        <p>Higher scores suggest greater potential for task activities to change with generative AI. They are not percentages of your job being replaced, your ability, or time saved.</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Average for your scored tasks</dt><dd className="font-semibold">{scoreLabel(insight.taskMean)}</dd></div>
          <div><dt className="text-muted-foreground">Published job reference</dt><dd className="font-semibold">{scoreLabel(insight.occupationScore)}</dd></div>
        </dl>
        <p>The first average uses only tasks with scores. The published job reference describes a wider set of tasks, so it may differ from your work.</p>
        <p>Your task average does not give you an official ILO occupation category.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <button type="button" className="underline underline-offset-4" onClick={onOpenDetails}>More about the method</button>
          <a className="underline underline-offset-4" href={ILO_OCCUPATION_EXPOSURE_SOURCE.href} target="_blank" rel="noopener noreferrer">ILO research</a>
          <a className="underline underline-offset-4" href={ILO_OCCUPATION_EXPOSURE_OPEN_DATA.href} target="_blank" rel="noopener noreferrer">Source data</a>
        </div>
      </div>
    </details>
  </section>;
}

import { useMemo, useState } from "react";

import { bandFromScore, TASK_BANDS, type TaskBandId } from "@/pages/Dashboard/AIExposure/taskBands";
import OccupationIndex from "@/pages/Dashboard/AIExposure/components/OccupationIndex";
import TaskExposureList from "@/pages/Dashboard/AIExposure/components/TaskExposureList";
import TaskMixPie from "@/pages/Dashboard/AIExposure/components/TaskMixPie";
import type { ConfirmedAnalysis } from "@/pages/Dashboard/analysisSession";

type AIExposureSectionProps = {
  analysis: ConfirmedAnalysis;
  highlightedTaskIds: string[];
};

const emptyCounts = () =>
  TASK_BANDS.reduce(
    (acc, band) => {
      acc[band.id] = 0;
      return acc;
    },
    {} as Record<TaskBandId, number>,
  );

const AIExposureSection = ({ analysis, highlightedTaskIds }: AIExposureSectionProps) => {
  const [activeBand, setActiveBand] = useState<TaskBandId | null>(null);

  const counts = useMemo(() => {
    const next = emptyCounts();
    for (const task of analysis.tasks) {
      const band = bandFromScore(task.score2025);
      if (band) next[band] += 1;
    }
    return next;
  }, [analysis.tasks]);

  const scoredCount = analysis.tasks.filter((task) => typeof task.score2025 === "number").length;
  const showing = activeBand
    ? `${TASK_BANDS.find((band) => band.id === activeBand)?.label} · ${counts[activeBand]}`
    : `all tasks · ${analysis.tasks.length}`;

  return (
    <div id="exposure" className="space-y-4 scroll-mt-24">
      <div className="grid gap-4 lg:grid-cols-2">
        <OccupationIndex
          title={analysis.occupationTitle}
          path={analysis.occupationPath}
          potential25={analysis.potential25}
          meanScore2025={analysis.meanScore2025}
        />
        <section className="rounded-2xl border bg-card p-5 md:p-6">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your tasks</p>
              <h2 className="mt-1 text-xl font-semibold">How these tasks may change</h2>
            </div>
            <p className="text-sm text-muted-foreground">Showing {showing}</p>
          </div>
          <TaskMixPie counts={counts} active={activeBand} onSelect={setActiveBand} />
        </section>
      </div>
      <section className="rounded-2xl border bg-card p-5 md:p-6">
        <p className="mb-3 text-sm text-muted-foreground">
          {activeBand ? "Tasks in the selected slice." : `${scoredCount} scored tasks. Unscored tasks stay in the list.`}
        </p>
        <TaskExposureList
          tasks={analysis.tasks}
          activeBand={activeBand}
          highlightedIds={highlightedTaskIds}
        />
      </section>
    </div>
  );
};

export default AIExposureSection;

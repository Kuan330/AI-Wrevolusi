import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { TASK_BANDS, type TaskBandId } from "@/pages/Dashboard/AIExposure/taskBands";

type TaskMixPieProps = {
  counts: Record<TaskBandId, number>;
  active: TaskBandId | null;
  onSelect: (band: TaskBandId | null) => void;
};

const TaskMixPie = ({ counts, active, onSelect }: TaskMixPieProps) => {
  const data = TASK_BANDS.map((band) => ({
    id: band.id,
    label: band.label,
    value: counts[band.id],
    color: band.color,
  })).filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3">
      <div className="mx-auto h-48 w-48">
        {total ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={48}
                outerRadius={76}
                paddingAngle={2}
                onClick={(entry) => {
                  const id = (entry as { payload?: { id?: TaskBandId }; id?: TaskBandId }).payload?.id
                    ?? (entry as { id?: TaskBandId }).id;
                  if (!id) return;
                  onSelect(active === id ? null : id);
                }}
              >
                {data.map((item) => (
                  <Cell
                    key={item.id}
                    fill={item.color}
                    opacity={active && active !== item.id ? 0.35 : 1}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    cursor="pointer"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No scored tasks</div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
        {TASK_BANDS.map((band) => {
          const value = counts[band.id];
          const selected = active === band.id;
          return (
            <button
              key={band.id}
              type="button"
              className={`inline-flex items-center gap-1.5 ${selected ? "font-semibold text-foreground" : "text-muted-foreground"}`}
              onClick={() => onSelect(selected ? null : band.id)}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: band.color }} />
              {band.label}
              <span className="tabular-nums">
                {value}
                {total ? ` · ${Math.round((value / total) * 100)}%` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Click a slice to see those tasks. Groups are from 2025 task scores, not official occupation bands.
      </p>
    </div>
  );
};

export default TaskMixPie;

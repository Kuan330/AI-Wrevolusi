import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";

import { TASK_BANDS, type TaskBandId } from "@/pages/Dashboard/lib/taskBands";

type TaskMixPieProps = {
  counts: Record<TaskBandId, number>;
  active: TaskBandId | null;
  onSelect: (band: TaskBandId | null) => void;
};

const ActiveSlice = (props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}) => (
  <Sector
    {...props}
    outerRadius={(props.outerRadius ?? 0) + 4}
    stroke="rgba(255,255,255,0.95)"
    strokeWidth={2}
  />
);

const TaskMixPie = ({ counts, active, onSelect }: TaskMixPieProps) => {
  const data = TASK_BANDS.map((band) => ({
    id: band.id,
    label: band.label,
    value: counts[band.id],
    color: band.color,
  })).filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const activeIndex = active ? data.findIndex((item) => item.id === active) : -1;

  const handleSelect = (id: TaskBandId) => {
    onSelect(active === id ? null : id);
  };

  return (
    <div className="dashboard-pie">
      <div className="dashboard-pie__chart">
        {total ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="48%"
                outerRadius="96%"
                paddingAngle={2}
                activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                activeShape={ActiveSlice}
                onClick={(entry) => {
                  const id =
                    (entry as { payload?: { id?: TaskBandId }; id?: TaskBandId }).payload?.id ??
                    (entry as { id?: TaskBandId }).id;
                  if (!id) return;
                  handleSelect(id);
                }}
              >
                {data.map((item) => (
                  <Cell
                    key={item.id}
                    fill={item.color}
                    opacity={active && active !== item.id ? 0.38 : 1}
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={2}
                    cursor="pointer"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#7f7280]">
            No scored tasks
          </div>
        )}
      </div>

      <div className="dashboard-pie__legend">
        {TASK_BANDS.map((band) => {
          const value = counts[band.id];
          if (value <= 0) return null;
          const selected = active === band.id;
          return (
            <button
              key={band.id}
              type="button"
              className={`dashboard-pie__legend-btn ${selected ? "is-active" : ""}`}
              onClick={() => handleSelect(band.id)}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: band.color }} />
              <span className="truncate">
                {band.label}
                {total ? (
                  <span className="tabular-nums">
                    {" "}
                    {value} · {Math.round((value / total) * 100)}%
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TaskMixPie;

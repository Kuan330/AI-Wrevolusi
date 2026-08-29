import { ILO_SCALE_CATEGORIES, NOT_SCORED_CATEGORY, groupTasksByIloScale } from "../../domain/profile";

const SHORT = {
  not_exposed: "Not exp.",
  minimal: "Minimal",
  g1: "G1",
  g2: "G2",
  g3: "G3",
  g4: "G4",
  not_scored: "Not scored",
};

export function GradeCountChart({ tasks, occupationLabel, activeId, onSelect }) {
  const groups = groupTasksByIloScale(tasks, occupationLabel);
  const columns = [...ILO_SCALE_CATEGORIES];
  if (groups.not_scored.length) columns.push(NOT_SCORED_CATEGORY);
  const counts = columns.map((c) => ({
    ...c,
    count: groups[c.id]?.length || 0,
    short: SHORT[c.id] || c.label,
    isOccupation: c.label === occupationLabel,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="grade-chart" role="img" aria-label="Task counts by exposure grade">
      {counts.map((c) => {
        const pct = (c.count / max) * 100;
        const active = activeId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            className={["grade-col", c.count === 0 ? "empty" : "", c.isOccupation ? "is-occupation" : "", active ? "active" : ""]
              .filter(Boolean)
              .join(" ")}
            disabled={c.count === 0}
            title={`${c.label}: ${c.count} task${c.count === 1 ? "" : "s"}`}
            onClick={() => onSelect(active ? null : c.id)}
          >
            <span className="grade-count">{c.count}</span>
            <span className="grade-bar-track">
              <span className="grade-bar" style={{ height: `${pct}%` }} />
            </span>
            <span className="grade-name">{c.short}</span>
          </button>
        );
      })}
    </div>
  );
}

import { formatScore, isScoredIloTask, nearestIloScaleCategory, scorePct, truncateTitle } from "../../domain/profile";

export function TaskScoreTable({ tasks, occupationLabel, onOpenTask }) {
  return (
    <div className="score-table-wrap">
      <table className="score-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Task</th>
            <th>Grade</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <p className="meta" style={{ margin: 0 }}>
                  No tasks in this grade. Click the bar again to show all.
                </p>
              </td>
            </tr>
          ) : (
            tasks.map((t) => {
              const scored = isScoredIloTask(t);
              const grade = scored ? nearestIloScaleCategory(t.score_2025, occupationLabel)?.label : "Not scored";
              return (
                <tr key={t.id}>
                  <td>
                    <button type="button" className="task-no" onClick={() => onOpenTask(t)}>
                      {t.display_no || "—"}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="task-title-btn" onClick={() => onOpenTask(t)}>
                      {truncateTitle(t.name)}
                    </button>
                  </td>
                  <td>
                    <span className="meta">{grade}</span>
                  </td>
                  <td>
                    {scored ? (
                      <div className="score-cell">
                        <span className="score-bar" style={{ width: `${scorePct(t.score_2025)}%` }} />
                        <strong>{formatScore(t.score_2025, 3)}</strong>
                      </div>
                    ) : (
                      <span className="meta">Not scored</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

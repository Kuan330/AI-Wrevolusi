import { ACTION_PLAN, REPORT_ROWS } from "./homeData";

const ReportSection = () => {
  return (
    <section className="report-section" id="report">
      <div className="container">
        <p className="report-label">
          Sample for a shop supervisor. Your result will follow the tasks you confirm.
        </p>
        <h2 className="report-title">A report you can actually act on</h2>
        <div className="report-grid">
          <div className="report-card glass">
            <h4>Task-change map</h4>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Work task</th>
                  <th>AI influence</th>
                  <th>Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {REPORT_ROWS.map((row) => (
                  <tr key={row.task}>
                    <td>{row.task}</td>
                    <td>
                      <span className={row.influenceClass}>{row.influence}</span>
                    </td>
                    <td>{row.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="report-tip">
              Core reminder: roles rarely vanish overnight. Task mix changes first.
            </div>
          </div>

          <div className="report-card glass">
            <h4>Your 90-day action plan</h4>
            <ol>
              {ACTION_PLAN.map((plan) => (
                <li key={plan.period}>
                  <strong>{plan.period}:</strong> {plan.detail}
                </li>
              ))}
            </ol>
            <div className="report-tip">
              Each step can be adjusted to the options you actually have.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReportSection;

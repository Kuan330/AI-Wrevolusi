import { Navigate, useNavigate } from "react-router-dom";
import { interpLabel } from "../constants";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../context/SessionContext";
import { formatScore } from "../domain/profile";

export function OverviewPage() {
  const navigate = useNavigate();
  const session = useSession();
  if (!session.profileConfirmed) return <Navigate to={session.occupation ? "/tasks" : "/match"} replace />;

  return (
    <>
      <PageHeader
        kicker="Read-only overview"
        title="Iteration 1 overview"
        lead="A cross-check of E1–E4. Editing stays on earlier pages — not here."
      />
      <div className="panel">
        <span className="badge b-blue">E1</span>
        <h3>{session.occupation?.title || "—"}</h3>
        <p className="meta">
          {session.occupation?.occupation_code || ""} · {session.tasks.length} tasks
        </p>
      </div>
      <div className="panel">
        <span className="badge b-pink">E2</span>
        {session.tasks.map((t) => (
          <p className="meta" key={t.id}>
            <strong>{t.display_no || "—"}</strong> · {formatScore(t.score_2025, 3)} · {t.name}
          </p>
        ))}
      </div>
      <div className="panel">
        <span className="badge b-pink">E3 · WEF</span>
        {session.caps.length ? (
          session.caps.map((c) => (
            <p className="meta" key={c.id}>
              {c.name} · {interpLabel(c.interpretation)}
            </p>
          ))
        ) : (
          <p className="meta">None</p>
        )}
      </div>
      <div className="actions">
        <Button variant="ghost" type="button" onClick={() => navigate("/skills")}>
          Back
        </Button>
        <Button variant="primary" type="button" onClick={() => navigate("/next")}>
          Enter Choose My Direction
        </Button>
      </div>
    </>
  );
}

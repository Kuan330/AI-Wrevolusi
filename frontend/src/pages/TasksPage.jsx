import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../context/SessionContext";
import { OccupationTaskPanel } from "../features/e1/OccupationTaskPanel";

export function TasksPage() {
  const navigate = useNavigate();
  const session = useSession();

  if (!session.occupation || session.occupation.level !== "unit") {
    return <Navigate to="/match" replace />;
  }

  return (
    <>
      <PageHeader
        kicker="E1 · Tasks"
        title="Confirm my tasks"
        lead="Add, edit, or remove tasks so this list matches your work. Scores stay on the next page."
      />
      <div className="panel">
        <h3>
          {session.occupation.occupation_code} {session.occupation.title}
        </h3>
        <p className="meta" style={{ margin: "0 0 16px" }}>
          Starter tasks come from ILO. Keep the ones you do.
        </p>
        <OccupationTaskPanel
          tasks={session.tasks}
          onChange={(next) => {
            session.setTasks(next);
            session.setProfileConfirmed(false);
          }}
          onToast={session.showToast}
        />
      </div>
      <div className="actions">
        <Button variant="ghost" type="button" onClick={() => navigate("/match")}>
          Back
        </Button>
        <Button
          variant="primary"
          type="button"
          disabled={!session.tasks.length}
          onClick={async () => {
            if (!session.tasks.length) {
              session.showToast("Add or keep at least one task.");
              return;
            }
            await session.confirmProfile(session.tasks);
            navigate("/exposure");
          }}
        >
          These are my tasks
        </Button>
      </div>
    </>
  );
}

import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../context/SessionContext";

export function BridgePage() {
  const navigate = useNavigate();
  const session = useSession();
  if (!session.profileConfirmed) return <Navigate to={session.occupation ? "/tasks" : "/match"} replace />;

  return (
    <>
      <PageHeader
        kicker="Bridge"
        title="What would you like next?"
        lead="E5 is optional. You can skip straight to preparation priorities (E6). These steps are not built in Iteration 1."
      />
      <div className="bridge-grid">
        <div className="panel">
          <h3>Explore nearby occupations</h3>
          <p className="meta">E5 · optional. Not a job guarantee.</p>
          <Button variant="ghost" type="button" disabled>
            Coming in Iteration 2
          </Button>
        </div>
        <div className="panel">
          <h3>Skip to preparation priorities</h3>
          <p className="meta">E6 · Choose what to prepare first.</p>
          <Button variant="ghost" type="button" disabled>
            Coming in Iteration 2
          </Button>
        </div>
      </div>
      <div className="actions">
        <Button variant="ghost" type="button" onClick={() => navigate("/overview")}>
          Back to overview
        </Button>
      </div>
    </>
  );
}

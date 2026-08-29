import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";

export function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="home-board">
      <div className="home-copy">
        <p className="logo">AI-Wrevolusi</p>
        <h1>See how AI may change your work.</h1>
        <p className="lead">
          Built for working women in Malaysia. You stay in control: review and adjust before anything moves forward.
        </p>
        <div className="home-points">
          <div>Start from your real tasks, not a job title alone.</div>
          <div>Possible change — not a prediction that your whole job disappears.</div>
        </div>
        <Button variant="primary" type="button" onClick={() => navigate("/match")}>
          Describe my work
        </Button>
        <p className="home-note">Iteration 1 · Pilot: Shop Supervisors and related sales occupations (MASCO 5221–5223).</p>
      </div>
    </div>
  );
}

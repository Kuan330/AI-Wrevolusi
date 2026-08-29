import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../context/SessionContext";
import { SkillList } from "../features/e3/SkillList";

export function SkillsPage() {
  const navigate = useNavigate();
  const session = useSession();
  if (!session.profileConfirmed) return <Navigate to={session.occupation ? "/tasks" : "/match"} replace />;

  return (
    <>
      <PageHeader
        kicker="E3 + E4 · WEF core skills"
        title="Skills from my work"
        lead="Suggested from the WEF 26 core skills — not a readiness score. NLP matching is not wired yet; you can keep, edit, or add skills in your own words."
      />
      <SkillList
        caps={session.caps}
        wefCatalog={session.wefCatalog}
        onChange={session.setCaps}
        onToast={session.showToast}
      />
      <div className="actions">
        <Button variant="ghost" type="button" onClick={() => navigate("/exposure")}>
          Back
        </Button>
        <Button variant="primary" type="button" onClick={() => navigate("/overview")}>
          Review my summary
        </Button>
      </div>
    </>
  );
}

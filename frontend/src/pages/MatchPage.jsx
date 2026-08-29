import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listOccupationTasks, listOccupations } from "../api/occupations";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../context/SessionContext";
import { mapIloRows } from "../domain/profile";
import { CASCADE_LEVELS } from "../constants";
import { OccupationCascade, loadMajorsInto, nextLevel } from "../features/e1/OccupationCascade";

function clearFrom(cascade, level) {
  const i = CASCADE_LEVELS.findIndex((l) => l.id === level);
  const selected = { ...cascade.selected };
  const options = { ...cascade.options };
  CASCADE_LEVELS.slice(i).forEach((l) => {
    selected[l.id] = null;
    if (l.id !== level) options[l.id] = [];
  });
  return { selected, options };
}

export function MatchPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.cascade.options.major.length) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await loadMajorsInto((next) => {
          if (!cancelled) session.setCascade(next);
        });
      } catch {
        if (!cancelled) {
          setError(
            "Cannot reach the API on port 8000. From the repo root run: python3 -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.cascade.options.major.length, session.setCascade]);

  async function onCascadeChange(level, code) {
    const picked = code
      ? session.cascade.options[level].find((o) => o.occupation_code === code)
      : null;

    session.setOccupation(null);
    session.setTasks([]);
    session.setProfileConfirmed(false);

    if (!picked) {
      session.setCascade((prev) => clearFrom(prev, level));
      return;
    }

    const next = nextLevel(level);
    const nextOptions = next ? await listOccupations(code) : [];
    session.setCascade((prev) => {
      const cleared = clearFrom(prev, level);
      return {
        selected: { ...cleared.selected, [level]: picked },
        options: next ? { ...cleared.options, [next]: nextOptions } : cleared.options,
      };
    });

    if (picked.level === "unit") {
      session.setOccupation(picked);
      const rows = await listOccupationTasks(picked.occupation_code);
      session.setTasks(mapIloRows(rows));
      await session.ensureWefCatalog();
      navigate("/tasks");
    }
  }

  const unitReady = session.occupation?.level === "unit";

  return (
    <>
      <PageHeader
        kicker="E1 · Occupation"
        title="Match my work"
        lead="Choose a major group, then a more specific group, then the occupation. You will confirm tasks on the next page."
      />
      {error ? <div className="error">{error}</div> : null}
      <div className="panel">
        <OccupationCascade cascade={session.cascade} onChange={onCascadeChange} />
      </div>
      {unitReady ? (
        <div className="panel">
          <h3>
            {session.occupation.occupation_code} {session.occupation.title}
          </h3>
          <p className="meta">{session.tasks.length} starter task{session.tasks.length === 1 ? "" : "s"} ready to review.</p>
          <div className="actions" style={{ marginTop: 16 }}>
            <span />
            <Button variant="primary" type="button" onClick={() => navigate("/tasks")}>
              Review tasks
            </Button>
          </div>
        </div>
      ) : null}
      <div className="actions">
        <Button variant="ghost" type="button" onClick={() => navigate("/")}>
          Back
        </Button>
      </div>
    </>
  );
}

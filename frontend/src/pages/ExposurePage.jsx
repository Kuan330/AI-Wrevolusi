import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getOccupationExposure } from "../api/occupations";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { useSession } from "../context/SessionContext";
import { formatScore, groupTasksByIloScale, isScoredIloTask, scorePct, sortTasksForTable, yourMix } from "../domain/profile";
import { GradeCountChart } from "../features/e2/GradeCountChart";
import { TaskScoreTable } from "../features/e2/TaskScoreTable";

export function ExposurePage() {
  const navigate = useNavigate();
  const session = useSession();
  const [index, setIndex] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);

  const code = session.occupation?.occupation_code;

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const row = await getOccupationExposure(code);
        if (!cancelled) {
          setIndex(row);
          setLoadError("");
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            "Could not load occupation exposure from the API (port 8000). Task scores below still use the list you confirmed."
          );
          const first = session.tasks.find((t) => t.mean_score_2025 != null);
          setIndex({
            occupation_code: code,
            title: session.occupation?.title,
            mean_score_2025: first?.mean_score_2025 ?? null,
            potential25: first?.potential25 ?? null,
            source: "ILO / Gmyrek et al. 2025",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const mix = useMemo(() => yourMix(session.tasks), [session.tasks]);
  const ranked = useMemo(() => sortTasksForTable(session.tasks), [session.tasks]);
  const listed = useMemo(() => {
    if (!gradeFilter) return ranked;
    const groups = groupTasksByIloScale(session.tasks, index?.potential25);
    const ids = new Set((groups[gradeFilter] || []).map((t) => t.id));
    return ranked.filter((t) => ids.has(t.id));
  }, [ranked, gradeFilter, session.tasks, index?.potential25]);
  const meanPct = scorePct(index?.mean_score_2025);
  const mixPct = mix.mean == null ? null : scorePct(mix.mean);

  if (!session.occupation || !session.tasks.length) return <Navigate to="/match" replace />;
  if (!session.profileConfirmed) return <Navigate to="/tasks" replace />;

  return (
    <>
      <PageHeader
        kicker="E2 · ILO 2025"
        title="How exposed is this work to AI"
        lead="The index is the occupation mean from ILO / Gmyrek et al. 2025. It describes possible task change — not a prediction that the job disappears."
      />
      {loadError ? <div className="error">{loadError}</div> : null}

      <section className="panel index-hero">
        <p className="index-kicker">
          {session.occupation.occupation_code} {session.occupation.title}
        </p>
        <div className="index-score">{formatScore(index?.mean_score_2025)}</div>
        <p className="index-label">{index?.potential25 || "No ILO category"}</p>
        <div className="index-meter" aria-hidden="true">
          <div className="index-meter-fill" style={{ width: `${meanPct}%` }} />
          <span className="index-needle occupation" style={{ left: `${meanPct}%` }} title="Occupation mean" />
          {mixPct != null ? (
            <span className="index-needle mix" style={{ left: `${mixPct}%` }} title="Your mix" />
          ) : null}
        </div>
        <div className="index-scale">
          <span>0</span>
          <span>Occupation mean</span>
          <span>1</span>
        </div>
        <p className="meta index-source">{index?.source || "ILO / Gmyrek et al. 2025"} · occupation-level mean</p>
        <p className="index-mix">
          Your mix {formatScore(mix.mean)}
          <span>
            {mix.scored} scored task{mix.scored === 1 ? "" : "s"}
            {mix.unscored ? ` · ${mix.unscored} not scored` : ""}
          </span>
        </p>
      </section>

      <section className="panel">
        <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Tasks by exposure grade</h3>
          <Button variant="ghost" small type="button" onClick={() => navigate("/tasks")}>
            Edit tasks
          </Button>
        </div>
        <p className="meta" style={{ margin: "0 0 16px" }}>
          Each bar is how many of <em>your</em> tasks fall in that grade (task score placed on the ILO 2025 occupation scale). Official{" "}
          <em>potential25</em> for this occupation is {index?.potential25 || "—"} — that is the index above, not these bars. Click a bar to filter the table.
        </p>
        <GradeCountChart
          tasks={session.tasks}
          occupationLabel={index?.potential25}
          activeId={gradeFilter}
          onSelect={setGradeFilter}
        />
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Tasks by exposure score</h3>
        <p className="meta" style={{ margin: "0 0 16px" }}>
          Sorted high to low. Open a number for the full wording. Added or edited tasks are not treated as zero.
        </p>
        <TaskScoreTable tasks={listed} occupationLabel={index?.potential25} onOpenTask={setDetail} />
      </section>

      <div className="actions">
        <Button variant="ghost" type="button" onClick={() => navigate("/tasks")}>
          Back
        </Button>
        <Button variant="primary" type="button" onClick={() => navigate("/skills")}>
          Continue
        </Button>
      </div>

      {detail ? (
        <Modal
          title={detail.display_no || "Task"}
          onClose={() => setDetail(null)}
          actions={
            <Button variant="primary" type="button" onClick={() => setDetail(null)}>
              Close
            </Button>
          }
        >
          <p className="body">{detail.name}</p>
          <p className="meta">
            ILO 2025 score {isScoredIloTask(detail) ? formatScore(detail.score_2025, 3) : "—"}
            {isScoredIloTask(detail) ? "" : " · not scored (added or edited by you)"}
          </p>
          <p className="meta">Occupation mean {formatScore(index?.mean_score_2025)} · {index?.potential25 || "—"}</p>
          <p className="meta">Possible task change only — not a job-loss prediction.</p>
        </Modal>
      ) : null}
    </>
  );
}

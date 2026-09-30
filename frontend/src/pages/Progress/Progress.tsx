import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { useAccount } from "@/components/account/useAccount";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { ApiError } from "@/services/api";
import { ROUTES } from "@/constants/routes";
import { progressReviewService, type ProgressPreview, type ProgressReview, type ReviewList, type ProgressSummary, type ProgressGoal, type ProgressEvidence } from "@/services/progressReviewService";
import "./progress.css";

const date = (value: string) => new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const goalsLabel = (count: number) => `${count} ${count === 1 ? "goal" : "goals"}`;
const errorText = (e: unknown) => e instanceof Error ? e.message : "Your review could not be loaded. Please try again.";
const statusLabels = { starting_point: "Starting point", comparable: "Same goal", new_goal: "New goal", needs_starting_point: "New starting point needed", source_needs_review: "Check the source context" };

export default function Progress() {
  const { user } = useAccount();
  return user ? <ProgressWorkspace key={user.id} /> : <p>Sign in to review your saved learning.</p>;
}
function ProgressWorkspace() {
  const [list, setList] = useState<ReviewList | null>(null);
  const [selected, setSelected] = useState<ProgressReview | null>(null);
  const [preview, setPreview] = useState<ProgressPreview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvedReset, setApprovedReset] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failedOperation, setFailedOperation] = useState<"load" | "prepare" | "save" | null>(null);
  const requestId = useRef<string | null>(null);
  const alive = useRef(true);
  const saveLock = useRef(false);
  const autoSelect = useRef(true);
  const prepareRun = useRef(0);
  useEffect(() => {
    alive.current = true;
    const changed = () => setRefresh(value => value + 1);
    window.addEventListener("workspace-change", changed); window.addEventListener("focus", changed);
    return () => { alive.current = false; window.removeEventListener("workspace-change", changed); window.removeEventListener("focus", changed); };
  }, []);
  async function prepare() {
    if (saveLock.current) return;
    autoSelect.current = false;
    const owner = currentWorkspaceSession(), run = ++prepareRun.current;
    setPreparing(true); setError(""); setNotice(""); setFailedOperation(null);
    try {
      const next = await progressReviewService.preview();
      if (!alive.current || owner !== currentWorkspaceSession() || run !== prepareRun.current) return;
      setPreview(next); setSelected(null); setSelectedId(null); setApprovedReset(false); setConflict(false); requestId.current = crypto.randomUUID();
    } catch (e) { if (alive.current && owner === currentWorkspaceSession() && run === prepareRun.current) { setError(errorText(e)); setFailedOperation("prepare"); } }
    finally { if (alive.current && owner === currentWorkspaceSession() && run === prepareRun.current) setPreparing(false); }
  }
  useEffect(() => {
    const abort = new AbortController(), owner = currentWorkspaceSession();
    setLoading(true);
    void progressReviewService.list(offset, abort.signal).then(next => {
      if (abort.signal.aborted || owner !== currentWorkspaceSession()) return;
      setList(next); setLoading(false);
      if (!next.total && !preview) void prepare();
      else if (autoSelect.current && next.items.length) { autoSelect.current = false; setSelectedId(next.items[0].id); }
    }).catch(e => { if (!abort.signal.aborted && owner === currentWorkspaceSession()) { setError(errorText(e)); setFailedOperation("load"); setLoading(false); } });
    return () => abort.abort();
    // Changing the viewed snapshot is deliberate; refresh never saves a review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, refresh]);
  useEffect(() => {
    if (!selectedId) return;
    const abort = new AbortController(), owner = currentWorkspaceSession();
    void progressReviewService.get(selectedId, abort.signal).then(next => {
      if (!abort.signal.aborted && owner === currentWorkspaceSession()) setSelected(next);
    }).catch(e => { if (!abort.signal.aborted && owner === currentWorkspaceSession()) { setError(errorText(e)); setFailedOperation("load"); } });
    return () => abort.abort();
  }, [selectedId, refresh]);
  async function save() {
    if (!preview || !requestId.current || saveLock.current || conflict || !preview.can_save || (preview.required_reset_goal_ids.length > 0 && !approvedReset)) return;
    const owner = currentWorkspaceSession(); saveLock.current = true; setSaving(true); setError("");
    try {
      const saved = await progressReviewService.save({ request_id: requestId.current, expected_workspace_revision: preview.workspace_revision, expected_previous_review_id: preview.previous_review_id, reset_goal_ids: approvedReset ? preview.required_reset_goal_ids : [] });
      if (!alive.current || owner !== currentWorkspaceSession()) return;
      setSelected(saved); setSelectedId(saved.id); setPreview(null); requestId.current = null; setFailedOperation(null); setNotice("Your dated review is saved."); setOffset(0); setRefresh(v => v + 1);
    } catch (e) {
      if (alive.current && owner === currentWorkspaceSession()) { setError(errorText(e)); setFailedOperation("save"); if (e instanceof ApiError && e.status === 409) setConflict(true); }
    } finally { saveLock.current = false; if (alive.current && owner === currentWorkspaceSession()) setSaving(false); }
  }
  const content = preview ?? selected?.snapshot;
  return <div className="progress-page">
    <PageHeader title="My progress" description="See what your saved learning and practice records show. You do not need to fill in another assessment." />
    {notice && <p role="status" className="progress-success">{notice}</p>}
    {error && <div role="alert" className="progress-warning"><p>{error}</p><button disabled={saving || preparing} onClick={() => { setError(""); if (failedOperation === "save" && !conflict) void save(); else if (conflict || failedOperation === "prepare") void prepare(); else setRefresh(v => v + 1); }}>{conflict ? "Refresh this preview" : "Retry"}</button></div>}
    {(loading && !list) && <p role="status">Loading your saved reviews…</p>}
    {selected && <section className="progress-card">
      <p className="progress-kicker">Saved review · {date(selected.created_at)}</p>
      {selected.status === "needs_review" ? <><h2>This review needs checking</h2><p>Some evidence was corrected or its context changed. This is a historical record, not current evidence.</p></> : selected.status === "new_evidence_available" ? <><h2>You have new records to review</h2><p>Your earlier review stays unchanged until you choose to save another.</p></> : <><h2>Your saved evidence</h2><p>This review describes records available on its saved date.</p></>}
      {selected.status_reasons.length > 0 && <details><summary>What changed?</summary><ul>{selected.status_reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></details>}
      <button className="progress-primary" disabled={saving || preparing} onClick={() => void prepare()}>{preparing ? "Preparing your review…" : "Reassess My Situation"}</button>
    </section>}
    {preview && <section className="progress-card">
      <p className="progress-kicker">Preview · {date(preview.reviewed_at)}</p><h2>{preview.previous_review_id ? "Review your latest records" : "Keep your first starting point"}</h2>
      <p>{preview.notice}</p><p>Nothing is saved until you confirm. Your AI exposure findings are not changed by this review.</p>
      {!preview.goals.length && <p><Link to={ROUTES.learningGoals}>Choose a learning goal first</Link>. Your existing courses remain available in My courses.</p>}
      {preview.required_reset_goal_ids.length > 0 && <div className="progress-warning"><p>{goalsLabel(preview.required_reset_goal_ids.length)} {preview.required_reset_goal_ids.length === 1 ? "needs" : "need"} a new starting point. Their earlier reviews stay in history and will not be described as an improvement or decline.</p><label><input type="checkbox" checked={approvedReset} disabled={saving} onChange={e => setApprovedReset(e.target.checked)} /> Use current records as the new starting point for these goals</label></div>}
      {preview.goals.some(g => g.status === "source_needs_review") && <p className="progress-warning">Goals with changed work or skill connections stay visible but are excluded from this comparison. You can review the remaining goals. <Link to={ROUTES.skills}>Review my skills</Link></p>}
      <button className="progress-primary" disabled={saving || preparing || conflict || !preview.can_save || (preview.required_reset_goal_ids.length > 0 && !approvedReset)} onClick={() => void save()}>{saving ? "Saving…" : preview.previous_review_id ? "Save this review" : "Save my starting point"}</button>
    </section>}
    {preparing && <p role="status">Preparing a review from your saved records…</p>}
    {content && <><Summary summary={content.summary} /><GoalComparisons key={preview ? `preview:${preview.reviewed_at}` : selected?.id} goals={content.goals} /></>}
    {list && list.items.length > 0 && <section className="progress-card"><h2>Earlier reviews</h2><p>Opening a review does not change it.</p><ul className="progress-history">{list.items.map(item => <li key={item.id}><button disabled={saving || preparing} onClick={() => { ++prepareRun.current; setPreview(null); setSelected(null); setSelectedId(item.id); setError(""); setNotice(""); }}>{date(item.created_at)}</button><span>{item.status === "needs_review" ? "Needs review" : item.status === "new_evidence_available" ? "New records available" : "Saved record"}</span></li>)}</ul><div className="progress-actions">{offset > 0 && <button disabled={loading} onClick={() => setOffset(v => Math.max(0,v-20))}>Newer reviews</button>}{offset + list.items.length < list.total && <button disabled={loading} onClick={() => setOffset(v => v+20)}>Older reviews</button>}</div></section>}
    <p className="progress-footnote">These are your recorded activities, not a skill grade, a job readiness score or proof of mastery. You can <Link to={ROUTES.learningGoals}>continue learning</Link> or <Link to={ROUTES.possibilities}>explore career options</Link> at any time.</p>
  </div>;
}
function Summary({ summary: s }: { summary: ProgressSummary }) {
  const counts = [["Work linked to skills you reported using",s.with_task_evidence],["Reported study",s.with_study],["Reported completed learning",s.with_completed_learning],["Course or sample practice",s.with_course_practice],["Workplace practice",s.with_workplace_practice],["Without usable supporting evidence",s.needing_evidence]] as const;
  return <section className="progress-card"><h2>What your records show</h2><p>{s.with_study ? `You have recorded study for ${s.with_study} of your ${goalsLabel(s.goals_total)}.` : `No study has been recorded for these ${goalsLabel(s.goals_total)} yet.`}</p><p>{s.with_workplace_practice ? `Workplace practice is recorded for ${goalsLabel(s.with_workplace_practice)}.` : "No workplace practice is recorded yet. This does not mean you lack the skill."}</p>{Boolean(s.excluded_goals) && <p>{goalsLabel(s.excluded_goals ?? 0)} need their source context checked and are excluded from the evidence counts.</p>}{s.new_goals > 0 && <p>{goalsLabel(s.new_goals)} added since the earlier review {s.new_goals === 1 ? "is" : "are"} shown separately. They are not an improvement or decline in your earlier goals.</p>}<details><summary>How these counts work</summary><p>Each number counts goals, not attempts. A goal can appear in several rows, so these numbers must not be added into one score. A work link is context, not proof of skill. No record does not mean no ability.</p><dl className="progress-counts">{counts.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details></section>;
}
function GoalComparisons({ goals }: { goals: ProgressGoal[] }) {
  const [limit,setLimit] = useState(10);
  return <section aria-label="Goal comparisons"><h2 className="progress-section-title">Your goals</h2>{goals.slice(0,limit).map(g => <article className="progress-card" key={g.goal_id}><p className="progress-kicker">{statusLabels[g.status]}</p><h3>{g.current.goal_wording}</h3><p className="progress-muted">{g.label}</p><p>{g.reason}</p>{g.next_step && <p><strong>Next step:</strong> {g.next_step}</p>}<div className="progress-compare">{g.earlier ? <Evidence label="Earlier record" evidence={g.earlier} /> : <div><h4>No earlier comparison</h4><p>{g.status === "new_goal" ? "This goal was added after the earlier review." : "The current records can become a dated starting point."}</p></div>}<Evidence label={g.status === "source_needs_review" ? "Records needing context review" : "Current record"} evidence={g.current} /></div><Link to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(g.goal_id)}`}>Continue this goal</Link></article>)}{goals.length > limit && <button onClick={() => setLimit(v=>v+10)}>Show more goals</button>}</section>;
}
function Evidence({ label, evidence: e }: { label: string; evidence: ProgressEvidence }) {
  const groups = [["Study",e.study],["Course or sample practice",e.course_practice],["Workplace practice",e.workplace_practice]] as const;
  return <div className="progress-evidence"><h4>{label}</h4><p className="progress-muted">{date(e.recorded_at)}</p><p>{e.goal_wording}</p><ul>{groups.map(([name,records])=><li key={name}>{name}: {records.length} record(s)</li>)}<li>Reported completed learning: {e.completed_learning.length}</li></ul><details><summary>See the supporting records</summary><p>{e.skill.label} · {e.skill.source === "personal" ? "Your own skill entry" : e.skill.source.toUpperCase()}{e.skill.sourceVersion ? ` ${e.skill.sourceVersion}` : ""}</p>{e.task_evidence.length ? <><h5>Linked work</h5><ul>{e.task_evidence.map(t=><li key={t.id}>{t.wording}</li>)}</ul></> : <p>No task evidence has a reported current skill connection.</p>}{e.confirmed_tasks && e.confirmed_tasks.length > 0 && e.task_evidence.length === 0 && <p>Work context saved with this goal: {e.confirmed_tasks.map(t => t.wording).join(". ")}</p>}{groups.map(([name,records])=>records.length>0&&<div key={name}><h5>{name}</h5><ul>{records.map(a=><li key={a.id}><time dateTime={a.date}>{a.date}</time>: {a.description}{a.task && <p>Work task: {a.task.wording}</p>}{a.notes && <p>{a.notes}</p>}</li>)}</ul></div>)}{e.completed_learning.map(course=><p key={course.id}>{course.title} · {course.source_label}{course.completed_at ? ` · ${course.completed_at}` : " · completion date not recorded"}</p>)}</details>{e.gaps.length>0&&<ul className="progress-muted">{e.gaps.map((gap,i)=><li key={i}>{gap}</li>)}</ul>}</div>;
}

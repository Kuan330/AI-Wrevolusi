import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { useAccount } from "@/components/account/useAccount";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { ApiError } from "@/services/api";
import { ROUTES } from "@/constants/routes";
import { progressReviewService, type ProgressPreview, type ProgressReview, type ReviewList, type ProgressSummary, type ProgressGoal, type ProgressEvidence } from "@/services/progressReviewService";
import { cleanDisplayText, goalDisplayLabel } from "@/lib/displayText";
import { activityGroups, attemptChanges, comparisonRows, evidenceTimeline, progressErrorText, progressHeadline, type ProgressOperation } from "./progressPresentation";
import "./progress.css";

const date = (value: string) => new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const cleanedNotes = (value: string) => value.split(/\r?\n/).map(cleanDisplayText).join("\n").trim();
const goalsLabel = (count: number) => `${count} ${count === 1 ? "goal" : "goals"}`;
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
  const [failedOperation, setFailedOperation] = useState<ProgressOperation | null>(null);
  const errorAlert = useRef<HTMLDivElement | null>(null);
  const requestId = useRef<string | null>(null);
  const alive = useRef(true);
  const saveLock = useRef(false);
  const autoSelect = useRef(true);
  const prepareRun = useRef(0);
  useEffect(() => {
    if (!error) return;
    errorAlert.current?.focus();
    errorAlert.current?.scrollIntoView({ block: "start" });
  }, [error]);
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
    } catch (e) { if (alive.current && owner === currentWorkspaceSession() && run === prepareRun.current) { setError(progressErrorText(e, "prepare")); setFailedOperation("prepare"); } }
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
    }).catch(e => { if (!abort.signal.aborted && owner === currentWorkspaceSession()) { setError(progressErrorText(e, "load")); setFailedOperation("load"); setLoading(false); } });
    return () => abort.abort();
    // Changing the viewed snapshot is deliberate; refresh never saves a review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, refresh]);
  useEffect(() => {
    if (!selectedId) return;
    const abort = new AbortController(), owner = currentWorkspaceSession();
    void progressReviewService.get(selectedId, abort.signal).then(next => {
      if (!abort.signal.aborted && owner === currentWorkspaceSession()) setSelected(next);
    }).catch(e => { if (!abort.signal.aborted && owner === currentWorkspaceSession()) { setError(progressErrorText(e, "load")); setFailedOperation("load"); } });
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
      if (alive.current && owner === currentWorkspaceSession()) { setError(progressErrorText(e, "save")); setFailedOperation("save"); if (e instanceof ApiError && e.status === 409) setConflict(true); }
    } finally { saveLock.current = false; if (alive.current && owner === currentWorkspaceSession()) setSaving(false); }
  }
  const content = preview ?? selected?.snapshot;
  return <div className="progress-page">
    <PageHeader title="Progress reviews" description="See what you recorded, what changed and your next step." />
    {notice && <p role="status" className="progress-success">{notice}</p>}
    {error && <div ref={errorAlert} tabIndex={-1} role="alert" className="progress-warning"><p>{error}</p><button disabled={saving || preparing} onClick={() => { setError(""); if (failedOperation === "save") { if (conflict) void prepare(); else void save(); } else if (failedOperation === "prepare") void prepare(); else setRefresh(v => v + 1); }}>{failedOperation === "save" && conflict ? "Refresh this preview" : "Retry"}</button></div>}
    {(loading && !list) && <p role="status">Loading your saved reviews…</p>}
    {content && <Summary summary={content.summary} goals={content.goals} historicalNeedsReview={selected?.status === "needs_review"} />}
    {selected && <section className="progress-card">
      <p className="progress-kicker">Saved review · {date(selected.created_at)}</p>
      {selected.status === "needs_review" ? <><h2>This review needs checking</h2><p>Some evidence was corrected or its context changed. This is a historical record, not current evidence.</p></> : selected.status === "new_evidence_available" ? <><h2>You have new records to review</h2><p>Your earlier review stays unchanged until you choose to save another.</p></> : <><h2>Your saved evidence</h2><p>This review describes records available on its saved date.</p></>}
      {selected.status_reasons.length > 0 && <details><summary>What changed?</summary><ul>{selected.status_reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></details>}
      <button className="progress-primary" disabled={saving || preparing} onClick={() => void prepare()}>{preparing ? "Preparing your review…" : "Review my progress"}</button>
    </section>}
    {preview && <section className="progress-card">
      <p className="progress-kicker">Preview · {date(preview.reviewed_at)}</p><h2>{preview.previous_review_id ? "Review your latest records" : "Keep your first starting point"}</h2>
      <p>Check the records below, then save this dated review.</p>
      {!preview.can_save && <p className="progress-warning">{cleanDisplayText(preview.notice)}</p>}
      <details><summary>About this review</summary><p>{cleanDisplayText(preview.notice)}</p><p>Nothing is saved until you confirm.</p></details>
      {!preview.goals.length && <p><Link to={ROUTES.learningGoals}>Choose a learning goal first</Link>. Your existing courses remain available in My courses.</p>}
      {preview.required_reset_goal_ids.length > 0 && <div className="progress-warning"><p>{goalsLabel(preview.required_reset_goal_ids.length)} {preview.required_reset_goal_ids.length === 1 ? "needs" : "need"} a new starting point. Earlier reviews stay in history.</p><label><input type="checkbox" checked={approvedReset} disabled={saving} onChange={e => setApprovedReset(e.target.checked)} /> Use current records as the new starting point for these goals</label></div>}
      {preview.goals.some(g => g.status === "source_needs_review") && <p className="progress-warning">Goals with changed work or skill connections stay visible but are excluded from this comparison. You can review the remaining goals. <Link to={ROUTES.skills}>Review my skills</Link></p>}
      <button className="progress-primary" disabled={saving || preparing || conflict || !preview.can_save || (preview.required_reset_goal_ids.length > 0 && !approvedReset)} onClick={() => void save()}>{saving ? "Saving…" : preview.previous_review_id ? "Save this review" : "Save my starting point"}</button>
    </section>}
    {preparing && <p role="status">Preparing a review from your saved records…</p>}
    {content && <><GoalComparisons key={preview ? `preview:${preview.reviewed_at}` : selected?.id} goals={content.goals} /></>}
    {list && list.items.length > 0 && <section className="progress-card"><h2>Earlier reviews</h2><p>Opening a review does not change it.</p><ul className="progress-history">{list.items.map(item => <li key={item.id}><button disabled={saving || preparing} onClick={() => { ++prepareRun.current; setPreview(null); setSelected(null); setSelectedId(item.id); setError(""); setNotice(""); }}>{date(item.created_at)}</button><span>{item.status === "needs_review" ? "Needs review" : item.status === "new_evidence_available" ? "New records available" : "Saved record"}</span></li>)}</ul><div className="progress-actions">{offset > 0 && <button disabled={loading} onClick={() => setOffset(v => Math.max(0,v-20))}>Newer reviews</button>}{offset + list.items.length < list.total && <button disabled={loading} onClick={() => setOffset(v => v+20)}>Older reviews</button>}</div></section>}
    <p className="progress-footnote">These are your recorded activities, not a skill grade, a job readiness score or proof of mastery. You can <Link to={ROUTES.learningGoals}>continue learning</Link> or <Link to={ROUTES.possibilities}>explore career options</Link> at any time.</p>
  </div>;
}
function Summary({ summary: s, goals, historicalNeedsReview }: { summary: ProgressSummary; goals: ProgressGoal[]; historicalNeedsReview?: boolean }) {
  const changes = goals.flatMap(attemptChanges);
  const corrected = changes.filter(item => item.kind === "corrected").length;
  const removed = changes.filter(item => item.kind === "removed").length;
  const hasComparison = goals.some(g => g.status === "comparable" && g.earlier);
  const counts = [["Reported study",s.with_study],["Reported completed learning",s.with_completed_learning],["Course or sample practice",s.with_course_practice],["Workplace practice",s.with_workplace_practice],["Work linked to reported skill use",s.with_task_evidence],["Without usable supporting evidence",s.needing_evidence]] as const;
  return <section className="progress-card progress-overview" aria-label="Review summary">
    <p className="progress-kicker">{historicalNeedsReview ? "Historical comparison · needs review" : "Your activity records"}</p>
    <h2>{progressHeadline(goals)}</h2>
    <p>{historicalNeedsReview ? "This describes the saved review. Some of its evidence has since changed." : hasComparison ? "Based on records for the same goal at two review dates. These are activity counts, not a skill grade." : "These saved activities can become a dated starting point. They describe your records, not a skill grade."}</p>
    {corrected + removed > 0 && <p>{corrected > 0 && `${corrected} ${corrected === 1 ? "record was" : "records were"} corrected. `}{removed > 0 && `${removed} ${removed === 1 ? "record was" : "records were"} removed. `}Corrections are shown separately from new attempts.</p>}
    <div className="progress-summary-metrics"><div><strong>{s.goals_total}</strong><span> {s.goals_total === 1 ? "goal in this review" : "goals in this review"}</span></div>{s.new_goals > 0 && <div><strong>{s.new_goals}</strong><span> {s.new_goals === 1 ? "new goal" : "new goals"}, shown separately</span></div>}{Boolean(s.excluded_goals) && <div><strong>{s.excluded_goals}</strong><span> {s.excluded_goals === 1 ? "goal needs" : "goals need"} a source check</span></div>}</div>
    <details><summary>See evidence across your goals</summary><p>These numbers count goals with at least one supporting record. A goal may appear in more than one row. The comparison below counts attempts for each goal.</p><dl className="progress-counts">{counts.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{goalsLabel(value)}</dd></div>)}</dl></details>
  </section>;
}
function GoalComparisons({ goals }: { goals: ProgressGoal[] }) {
  const [limit,setLimit] = useState(10);
  const ordered = [...goals.filter(g => g.status === "comparable"), ...goals.filter(g => g.status !== "comparable")];
  return <section aria-label="Goal comparisons"><h2 className="progress-section-title">Your goals</h2>{ordered.slice(0,limit).map(g => <GoalCard goal={g} key={g.goal_id} />)}{goals.length > limit && <button onClick={() => setLimit(v=>v+10)}>Show more goals</button>}</section>;
}
function GoalCard({ goal: g }: { goal: ProgressGoal }) {
  const comparable = g.status === "comparable" && Boolean(g.earlier);
  const timeline = evidenceTimeline(g);
  const removed = attemptChanges(g).filter(item => item.kind === "removed");
  return <article className="progress-card">
    <p className="progress-kicker">{statusLabels[g.status]}</p><h3>{goalDisplayLabel(g.current.goal_wording, g.current.skill.label)}</h3>
    {cleanDisplayText(g.label) !== goalDisplayLabel(g.current.goal_wording, g.current.skill.label) && <p className="progress-muted">Skill: {cleanDisplayText(g.label)}</p>}
    {!comparable && <p>{g.status === "new_goal" ? "Added after the earlier review. Its records are shown as a starting point." : g.status === "source_needs_review" ? "The work or skill connection changed. These records are excluded from the progress comparison." : g.status === "needs_starting_point" ? "Earlier evidence or goal context changed. Keep a new starting point before comparing progress." : "Your first saved records for this goal. Future reviews can compare against this starting point."}</p>}
    <ActivityComparison goal={g} />
    {g.next_step && <div className="progress-next-step"><strong>Next step</strong><p>{cleanDisplayText(g.next_step)}</p><Link to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(g.goal_id)}`}>Continue this goal</Link></div>}
    {timeline.length > 0 && <details className="progress-timeline"><summary>Activity timeline · {timeline.length} {timeline.length === 1 ? "record" : "records"}</summary><ol>{timeline.map(({attempt:a,group,change})=><li key={a.id}><div className="progress-timeline-meta"><time dateTime={a.date}>{a.date}</time><span>{activityGroups.find(([key])=>key===group)?.[1]}</span><strong>{change === "added" ? "New attempt" : change === "corrected" ? "Corrected record" : comparable ? "Earlier saved record" : "Recorded activity"}</strong></div><p>{cleanDisplayText(a.description)}</p>{(a.task || a.notes) && <details><summary>Attempt details</summary>{a.task && <p>Work task: {cleanDisplayText(a.task.wording)}</p>}{a.notes && <p className="progress-attempt-notes">{cleanedNotes(a.notes)}</p>}</details>}</li>)}</ol></details>}
    {removed.length > 0 && <details><summary>{removed.length} {removed.length === 1 ? "removed record" : "removed records"}</summary><p>These were in the earlier review. Removing a record does not show a change in ability.</p><ul>{removed.map(item=><li key={item.attempt.id}>{item.attempt.date}: {cleanDisplayText(item.attempt.description)}</li>)}</ul></details>}
    <details><summary>Work connections and evidence gaps</summary><p>{cleanDisplayText(g.reason)}</p><div className="progress-compare">{g.earlier && <Evidence label="Earlier saved evidence" evidence={g.earlier} />}<Evidence label={g.status === "source_needs_review" ? "Evidence needing context review" : "Current saved evidence"} evidence={g.current} /></div></details>
  </article>;
}
function ActivityComparison({ goal: g }: { goal: ProgressGoal }) {
  const {rows,scale} = comparisonRows(g);
  const comparable = g.status === "comparable" && Boolean(g.earlier);
  return <div className="progress-activity-chart">
    <p className="progress-muted">{comparable ? `Earlier review: ${date(g.earlier!.recorded_at)} · Current review: ${date(g.current.recorded_at)}` : `Recorded by ${date(g.current.recorded_at)}`}</p>
    <table><caption>{comparable ? "Activity records for the same goal" : g.status === "source_needs_review" ? "Records awaiting a source check" : "Records at this starting point"}. Study and practice count attempts. Workplace practice needs current confirmed work context. Completed learning counts linked courses.</caption><thead><tr><th scope="col">Activity</th>{comparable && <th scope="col">Earlier</th>}<th scope="col">Current</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><th scope="row">{row.label}</th>{row.earlier !== null && <td><CountBar value={row.earlier} scale={scale} earlier /></td>}<td><CountBar value={row.value} scale={scale} /></td></tr>)}</tbody></table>
  </div>;
}
function CountBar({value,scale,earlier=false}: {value:number;scale:number;earlier?:boolean}) {
  return <div className={`progress-bar-count${earlier ? " progress-bar-count-earlier" : ""}`}><strong>{value}</strong><span className="progress-bar-track" aria-hidden="true"><span style={{width:`${value / scale * 100}%`}} /></span></div>;
}
function Evidence({ label, evidence: e }: { label: string; evidence: ProgressEvidence }) {
  return <div className="progress-evidence"><h4>{label}</h4><p className="progress-muted">{date(e.recorded_at)}</p><p>{cleanDisplayText(e.skill.label)} · {e.skill.source === "personal" ? "Your own skill entry" : e.skill.source.toUpperCase()}{e.skill.sourceVersion ? ` ${e.skill.sourceVersion}` : ""}</p>{e.task_evidence.length ? <><h5>Linked work</h5><ul>{e.task_evidence.map(t=><li key={t.id}>{cleanDisplayText(t.wording)}</li>)}</ul></> : <p>No task evidence has a reported current skill connection.</p>}{e.confirmed_tasks && e.confirmed_tasks.length > 0 && e.task_evidence.length === 0 && <details><summary>Saved work context</summary><ul>{e.confirmed_tasks.map(t=><li key={t.id}>{cleanDisplayText(t.wording)}</li>)}</ul></details>}{e.completed_learning.map(course=><p key={course.id}>{cleanDisplayText(course.title)} · {cleanDisplayText(course.source_label)}{course.completed_at ? ` · ${course.completed_at}` : " · completion date not recorded"}</p>)}{e.gaps.length>0 && <><h5>Evidence gaps</h5><ul className="progress-muted">{e.gaps.map((gap,i)=><li key={i}>{cleanDisplayText(gap)}</li>)}</ul></>}</div>;
}

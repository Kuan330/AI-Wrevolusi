import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, Mic, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSelect, Textarea } from "@/components/ui/form-field";
import { ROUTES } from "@/constants/routes";
import { prepareInterviewContext } from "@/features/interview/resumeItems";
import { interviewService } from "@/features/interview/service";
import { createSession, sessionProgress, type InterviewSession } from "@/features/interview/session";
import { availableChangeTasks, changeTopics, futureInterviewOccupation, interviewCareer, planBody } from "@/features/interview/start";
import { loadResumeDraft } from "@/features/resume/repository";
import { reviewState } from "@/features/resume/review";
import type { ResumeDraft } from "@/features/resume/types";

const dateText = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
type Props = { owner: string; sessions: InterviewSession[]; onStart: (session: InterviewSession) => void; onOpen: (id: string) => void; onDelete: (id: string) => Promise<void> };
export default function StartPanel({ owner, sessions, onStart, onOpen, onDelete }: Props) {
  const [draft, setDraft] = useState<ResumeDraft | null>(null), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [extra, setExtra] = useState(""), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState<"" | InterviewSession["mode"]>(""), [error, setError] = useState("");
  const [taskLinks, setTaskLinks] = useState<Record<string, string>>({}), [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [deleting, setDeleting] = useState<InterviewSession | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let live = true;
    loadResumeDraft(owner).then(value => { if (live) setDraft(value); }).catch(cause => { if (live) setLoadError(cause instanceof Error ? cause.message : "Your resume could not be read."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; request.current?.abort(); };
  }, [owner]);
  useEffect(() => {
    const update = () => { setWorkspaceVersion(value => value + 1); setAccepted(false); };
    window.addEventListener("workspace-change", update);
    return () => window.removeEventListener("workspace-change", update);
  }, []);

  const state = draft ? reviewState(draft) : { status: "missing" as const };
  const prepared = useMemo(() => draft?.document ? prepareInterviewContext(draft.document, draft.jobRequirements, extra) : null, [draft, extra]);
  const changeTasks = useMemo(() => availableChangeTasks(), [workspaceVersion]);
  const topics = useMemo(() => prepared ? changeTopics(prepared, taskLinks) : [], [prepared, taskLinks, workspaceVersion]);
  const career = interviewCareer();
  const future = futureInterviewOccupation();
  const hasResumeRole = Boolean(draft?.jobRequirements.trim());
  const ready = state.status === "reviewed" && hasResumeRole && Boolean(prepared?.display.length);

  const start = async (mode: InterviewSession["mode"]) => {
    if (busy) return;
    setError(""); setBusy(mode);
    const controller = new AbortController();
    request.current = controller;
    try {
      if (mode === "career" && !future) throw new Error("Choose a future occupation in Possibilities first.");
      const bank = await interviewService.bank(mode === "career" ? future!.code : mode === "resume" ? career?.code ?? "0000" : "0000", controller.signal).catch(() => null);
      if (mode === "resume" && (!prepared || !draft || state.status !== "reviewed" || !hasResumeRole)) throw new Error("Set your target role and review your resume first.");
      const plan = mode === "resume" && prepared
        ? await interviewService.plan(planBody(prepared, bank?.questions ?? [], topics, accepted), controller.signal)
        : await interviewService.plan({ role_title: mode === "career" ? future!.title : "", items: [], topics: [], count: 4, items_reviewed: false, bank: (bank?.questions ?? []).slice(0, 12).map(q => ({ id: q.id, question: q.question })) }, controller.signal);
      if (controller.signal.aborted) return;
      const session = mode === "resume" && prepared && draft && state.at
        ? createSession({ mode, role: { title: prepared.roleTitle, sentTitle: prepared.sentRoleTitle, requirements: draft.jobRequirements,
          ...(career?.title.toLowerCase() === prepared.roleTitle.toLowerCase() ? { occupationCode: career.code } : {}) }, resumeVersion: { reviewedAt: state.at, itemCount: prepared.display.length }, items: prepared.display, plan, restore: prepared.restore })
        : createSession({ mode, role: mode === "career" ? { title: future!.title, sentTitle: future!.title, occupationCode: future!.code, requirements: "" } : { title: "General practice", sentTitle: "", requirements: "" }, resumeVersion: null, items: [], plan });
      onStart(session);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not prepare your questions. Try again."); }
    finally { if (request.current === controller) { request.current = null; setBusy(""); } }
  };

  return <div className="ip-start">
    {error && <p className="ip-note" role="alert">{error}</p>}
    <Card className="ip-card">
      <h2>Your future occupation</h2>
      {future ? <>
        <p><strong>{future.title}</strong></p>
        <p className="ip-hint">Practise questions for this occupation. No resume is needed, and choosing this role does not mean you already have its skills.</p>
        <div className="ip-actions"><Button disabled={Boolean(busy)} onClick={() => { void start("career"); }}>{busy === "career" ? "Preparing questions…" : "Practise for this occupation"}</Button>
          <Button asChild variant="outline"><Link to={ROUTES.possibilities}>Change future occupation</Link></Button></div>
      </> : <><p className="ip-hint">Choose a future occupation in Possibilities to practise for that role without making a resume.</p>
        <Button asChild variant="outline"><Link to={ROUTES.possibilities}>Choose a future occupation</Link></Button></>}
      <div className="ip-actions"><Button variant="ghost" disabled={Boolean(busy)} onClick={() => { void start("general"); }}>{busy === "general" ? "Preparing questions…" : "Practise general questions"}</Button></div>
    </Card>
    <Card className="ip-card">
      <h2><FileText size={18} />Practice from your resume · optional</h2>
      {loading ? <p role="status">Loading your resume…</p> : loadError ? <p className="ip-note" role="alert">{loadError}</p> : <>
        <dl className="ip-facts">
          <div><dt>Target role</dt><dd>{prepared?.roleTitle && draft?.jobRequirements.trim() ? prepared.roleTitle : "Not set yet"}</dd></div>
          <div><dt>Resume version</dt><dd>{state.status === "reviewed" ? <><CheckCircle2 size={15} className="ip-ok" /> Reviewed on {dateText(state.at!)}, {prepared?.display.length ?? 0} items</>
            : state.status === "needs-review" ? <><TriangleAlert size={15} className="ip-warn" /> Changed since you last reviewed it</> : "No resume yet"}</dd></div>
        </dl>
        {(state.status !== "reviewed" || !hasResumeRole) && <div className="ip-callout" role="status"><p>{state.status === "reviewed" && !hasResumeRole ? "Add a target role in the Resume builder to practise from this resume. Future occupation practice above is still available." : state.status === "needs-review" ? "Review your resume again to practise from its latest version. You can still practise for your future occupation above." : "A reviewed resume lets you practise questions about your own experience. You can practise for your future occupation above without one."}</p>
          <Button asChild><Link to={ROUTES.resumeBuilder}>Open Resume builder</Link></Button></div>}
        {ready && prepared && <>
          <details className="ip-details"><summary>What AI will receive</summary>
            <p className="ip-hint">Your name and contact details stay on this device. Check this list and remove anything private from your resume or add it below.</p>
            <FormField label="Extra private words to hide (one per line)"><Textarea rows={2} maxLength={2000} value={extra} onChange={event => { setExtra(event.target.value); setAccepted(false); }} /></FormField>
            {changeTasks.length > 0 && prepared.display.filter(item => item.kind === "work").map(item => <FormField key={item.id} label={`Work task linked to ${item.label}`} hint="Only link a task that this experience entry describes. Its research result can guide an AI-change question.">
              <FormSelect label={`Work task linked to ${item.label}`} value={taskLinks[item.id] ?? ""} placeholder="No work task linked" options={[{ value: "", label: "No work task linked" }, ...changeTasks.map(task => ({ value: task.id, label: task.text }))]} onValueChange={value => { setTaskLinks(old => ({ ...old, [item.id]: value })); setAccepted(false); }} />
            </FormField>)}
            <Textarea readOnly rows={9} aria-label="What AI will receive" value={JSON.stringify({ role: prepared.sentRoleTitle, items: prepared.sent, work_tasks: topics }, null, 2)} />
            <p className="ip-hint">Hiding words automatically can miss things. Your answers are only sent when you submit them.</p></details>
          <label className="ip-accept"><Checkbox checked={accepted} onCheckedChange={value => setAccepted(value === true)} />I checked this and want to send it to AI.</label>
          <p className="ip-hint">You will get 3 to 5 practice questions based on your resume and role. If AI is not available you still get simple questions.</p>
        </>}
        <div className="ip-actions"><Button disabled={!ready || !accepted || Boolean(busy)} onClick={() => { void start("resume"); }}>{busy === "resume" ? "Preparing questions…" : "Start practice"}</Button></div>
        <p className="ip-hint"><Mic size={13} /> You can answer by typing or speaking. You can skip any question and stop whenever you like.</p>
      </>}
    </Card>
    <Card className="ip-card">
      <h2>Your saved practice</h2>
      {sessions.length === 0 ? <p className="ip-hint">Nothing yet. Your answers and feedback stay on this device only.</p> :
        <ul className="ip-saved">{sessions.map(session => { const p = sessionProgress(session); return <li key={session.id}>
          <div><strong>{session.role.title}</strong><span>{dateText(session.updatedAt)} · {session.mode === "resume" ? "From your resume" : session.mode === "career" ? "Future occupation" : "General"} · {p.answered + p.skipped} of {p.total} done</span></div>
          <div className="ip-actions"><Button size="sm" onClick={() => onOpen(session.id)}>{p.complete ? "Review" : "Continue"}</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(session)}>Delete</Button></div></li>; })}</ul>}
    </Card>
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null); }}><DialogContent>
      <DialogHeader><DialogTitle>Delete this practice?</DialogTitle><DialogDescription>Your questions, answers and feedback for this practice are removed from this device. This cannot be undone.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Keep it</Button><Button variant="destructive" onClick={() => { const target = deleting; setDeleting(null); if (target) void onDelete(target.id); }}>Delete</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

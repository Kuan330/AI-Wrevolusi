import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Check, ChevronDown, ChevronUp, LoaderCircle, MessageSquare, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/form-field";
import { modelPreferenceRevision, subscribeModelPreferences } from "@/infrastructure/storage/modelPreferences";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { applyAssistantProposal, prepareAssistantContext, restoreAssistantValue, type AssistantMessage } from "@/features/resume/assistant";
import { documentYaml, parseResumeYaml } from "@/features/resume/document";
import { resumeService } from "@/features/resume/service";
import { resumeErrorMessage } from "@/features/resume/errors";
import type { ResumeDocument, SkillCandidate } from "@/features/resume/types";

const suggestions = ["Make the descriptions more concise.", "Improve the wording without adding facts.", "Highlight my existing skills relevant to the target role.", "Use the moderncv theme with a clean blue colour palette."];
type ActiveRequest = { controller: AbortController; instruction: string };
type AppliedChange = { beforeKey: string; afterKey: string };
type Props = {
  document: ResumeDocument; documentVersion: number; skills: SkillCandidate[]; owner: string;
  disabledReason: string; jobRequirements: string; targetKey: string; apply: (document: ResumeDocument) => boolean;
  undo: () => void; canUndo: boolean; previousDocumentKey: string | null;
};

export default function ResumeAssistant(props: Props) {
  const [open, setOpen] = useState(false), [instruction, setInstruction] = useState(""), [extra, setExtra] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]), [activeInstruction, setActiveInstruction] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [lastApplied, setLastApplied] = useState<AppliedChange | null>(null);
  const request = useRef<ActiveRequest | null>(null), mounted = useRef(true);
  const session = useRef(currentWorkspaceSession());
  const body = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => { if (open && body.current) body.current.scrollTop = body.current.scrollHeight; }, [open, messages, activeInstruction]);
  const modelVersion = useSyncExternalStore(subscribeModelPreferences, modelPreferenceRevision, () => 0);
  const documentKey = JSON.stringify(props.document);
  const inputKey = JSON.stringify([props.owner, documentKey, props.skills, extra, props.documentVersion, modelVersion, props.jobRequirements, props.targetKey, props.disabledReason]);
  const inputVersion = useRef(inputKey);
  useLayoutEffect(() => { inputVersion.current = inputKey; }, [inputKey]);
  const isCurrent = () => mounted.current && session.current === currentWorkspaceSession();
  const stop = useCallback((message: string, failed = false) => {
    const active = request.current;
    if (!active) return;
    request.current = null; active.controller.abort();
    setInstruction(active.instruction); setActiveInstruction(""); setBusy(false);
    setStatus(failed ? "" : message); setError(failed ? message : "");
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.controller.abort(); request.current = null; };
  }, [props.owner]);
  useEffect(() => {
    stop("The resume or model settings changed. Send again using the latest version.", true);
  }, [inputKey, props.disabledReason, stop]);

  const send = async () => {
    // The ref is a synchronous lock, including click + shortcut in the same render.
    if (!isCurrent() || !instruction.trim() || props.disabledReason || request.current) return;
    const active = { controller: new AbortController(), instruction: instruction.trim() };
    request.current = active;
    setOpen(true); setError(""); setStatus(""); setBusy(true);
    setActiveInstruction(active.instruction); setInstruction("");
    const sentInput = inputKey, sentDocument = props.document, sentKey = documentKey, sentModel = modelVersion;
    try {
      const context = prepareAssistantContext(sentDocument, props.skills, active.instruction, extra);
      const target = context.redact(props.jobRequirements);
      const safeInstruction = context.instruction + (target ? `\nTarget role (context only, not evidence):\n${target.slice(0, Math.max(0, 4900 - context.instruction.length))}` : "");
      const history = messages.slice(-10).map(message => ({ ...message, content: context.redact(message.content).slice(0, 1400) }));
      const result = await resumeService.assist(safeInstruction, context.document, context.skills, history, active.controller.signal);
      if (!isCurrent() || request.current !== active || active.controller.signal.aborted) return;
      if (inputVersion.current !== sentInput || sentModel !== modelPreferenceRevision()) {
        stop("The resume or model settings changed. Send again using the latest version.", true);
        return;
      }
      // Validate and restore every change before making one atomic editor update.
      const next = applyAssistantProposal(sentDocument, result,
        [...result.sections.map(section => `section-${section.section_index}`), ...result.design.map((_, index) => `design-${index}`)], context.mapping);
      const reply = String(restoreAssistantValue(result.message, context.mapping));
      if (parseResumeYaml(documentYaml(next)).error) throw new Error("The assistant returned an invalid resume document. Your resume is unchanged.");
      const nextKey = JSON.stringify(next), changed = nextKey !== sentKey;
      if (changed && !props.apply(next)) throw new Error("The resume changed before the edits could be applied. Send again using the latest version.");
      // Clear the request before our own editor update triggers version effects.
      request.current = null; setBusy(false); setActiveInstruction("");
      if (changed) setLastApplied({ beforeKey: sentKey, afterKey: nextKey });
      setStatus(changed ? "Changes applied" : "No changes were needed. Your resume is unchanged.");
      setMessages(old => [...old, { role: "user", content: active.instruction.slice(0, 3000) }, { role: "assistant", content: reply }].slice(-10) as AssistantMessage[]);
    } catch (cause) {
      if (isCurrent() && request.current === active && !active.controller.signal.aborted) {
        setError(resumeErrorMessage(cause)); setInstruction(active.instruction);
      }
    } finally {
      if (isCurrent() && request.current === active) { request.current = null; setBusy(false); setActiveInstruction(""); }
    }
  };
  const canUndoLast = Boolean(lastApplied && props.canUndo && documentKey === lastApplied.afterKey && props.previousDocumentKey === lastApplied.beforeKey && !props.disabledReason && !busy);
  return <section className={`rw-assistant ${open ? "rw-assistant-open" : ""}`} aria-label="AI resume assistant">
    <div className="rw-assistant-heading"><Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(value => !value)}><MessageSquare size={16} />AI assistant{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</Button>{open && <span>Edits apply directly · Undo anytime</span>}</div>
    {open && <div className="rw-assistant-body" ref={body}>
      <div className="rw-assistant-shortcuts">{suggestions.map(suggestion => <Button key={suggestion} variant="outline" size="sm" disabled={busy || Boolean(props.disabledReason)} onClick={() => setInstruction(suggestion)}>{suggestion}</Button>)}</div>
      <div className="rw-assistant-messages" role="log" aria-live="polite">
        {messages.map((message, index) => <p key={index} className={`rw-assistant-message rw-message-${message.role}`}><strong>{message.role === "user" ? "You" : "Assistant"}</strong>{message.content}</p>)}
        {activeInstruction && <p className="rw-assistant-message rw-message-user"><strong>You</strong>{activeInstruction}</p>}
      </div>
      <details className="rw-assistant-privacy"><summary>Privacy options</summary>
        <p className="rw-assistant-note">Personal fields stay local. Known private information is automatically redacted before sending. Automatic redaction may miss information; third-party retention policies still apply.</p>
        <FormField label="Additional private terms (one per line)"><Textarea rows={2} value={extra} maxLength={4000} onChange={event => setExtra(event.target.value)} placeholder="Optional names or confidential terms to hide" /></FormField>
        <p className="rw-assistant-note">These terms stay in this page session and are cleared when you leave or switch accounts.</p>
      </details>
    </div>}
    {open && busy && <div className="rw-assistant-working" role="status"><LoaderCircle size={14} aria-hidden="true" />Updating your resume…</div>}
    {open && (status || canUndoLast) && <div className="rw-assistant-result"><span role="status">{status === "Changes applied" && <Check size={14} aria-hidden="true" />}{status}</span>{canUndoLast && <Button variant="ghost" size="sm" onClick={() => { props.undo(); setStatus("Changes undone"); }}><Undo2 size={14} />Undo changes</Button>}</div>}
    {props.disabledReason && <p className="rw-assistant-note" role="status">{props.disabledReason}</p>}{error && <p className="rw-assistant-error" role="alert">{error}</p>}
    <div className="rw-assistant-composer"><Textarea aria-label="Ask AI to edit your resume" rows={2} maxLength={4800} value={instruction} disabled={busy || Boolean(props.disabledReason)} placeholder="Ask for changes to your resume…" onFocus={() => setOpen(true)} onChange={event => setInstruction(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /><Button size="icon" aria-label={busy ? "Cancel assistant request" : "Send assistant instruction"} disabled={!busy && (!instruction.trim() || Boolean(props.disabledReason))} onClick={() => busy ? stop("Request cancelled. Your resume is unchanged.") : void send()}>{busy ? <X /> : <ArrowUp />}</Button></div>
    <p className="rw-assistant-note">Edits apply directly and can be undone. Personal fields stay local; provider retention policies apply.</p>
  </section>;
}

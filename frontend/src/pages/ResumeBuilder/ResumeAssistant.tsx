import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, ChevronDown, ChevronUp, MessageSquare, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Textarea } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { modelPreferenceRevision, subscribeModelPreferences } from "@/infrastructure/storage/modelPreferences";
import { applyAssistantProposal, assistantReviewKey, prepareAssistantContext, restoreAssistantValue, type AssistantMessage, type AssistantProposal } from "@/features/resume/assistant";
import { controlFields } from "@/features/resume/editorModel";
import { entryText } from "@/features/resume/document";
import { resumeService } from "@/features/resume/service";
import { resumeErrorMessage } from "@/features/resume/errors";
import type { ResumeDocument, ResumeEntry, SkillCandidate } from "@/features/resume/types";
const suggestions = ["Make the descriptions more concise.", "Improve the wording without adding facts.", "Highlight my existing skills relevant to the target role.", "Use the moderncv theme with a clean blue colour palette."];
type Pending = { proposal: AssistantProposal; documentKey: string; documentVersion: number; modelVersion: number; mapping: Record<string, string> };
type Props = { document: ResumeDocument; documentVersion: number; skills: SkillCandidate[]; owner: string; disabledReason: string; apply: (document: ResumeDocument) => void; jobRequirements: string };
export default function ResumeAssistant(props: Props) {
  const [open, setOpen] = useState(false), [instruction, setInstruction] = useState(""), [extra, setExtra] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false), [reviewed, setReviewed] = useState(""), [reviewAccepted, setReviewAccepted] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]), [pending, setPending] = useState<Pending | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null), mounted = useRef(true);
  const modelVersion = useSyncExternalStore(subscribeModelPreferences, modelPreferenceRevision, () => 0);
  const documentKey = JSON.stringify(props.document), reviewKey = assistantReviewKey(props.document, props.skills, extra);
  const context = useMemo(() => prepareAssistantContext(props.document, props.skills, instruction, extra), [props.document, props.skills, instruction, extra]);
  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, [props.owner]);
  useEffect(() => { if (request.current) { request.current.abort(); request.current = null; setBusy(false); setError("The resume or model settings changed. Send again using the latest version."); } }, [documentKey, props.documentVersion, modelVersion, props.disabledReason]);
  const stale = Boolean(pending && (pending.documentKey !== documentKey || pending.documentVersion !== props.documentVersion || pending.modelVersion !== modelVersion));
  const send = async (confirmed = false) => {
    if (!instruction.trim() || props.disabledReason || busy) return;
    setOpen(true); setError("");
    if (!confirmed && reviewed !== reviewKey) { setReviewAccepted(false); setReviewOpen(true); return; }
    const controller = new AbortController(); request.current = controller; setBusy(true); setReviewOpen(false);
    const sentKey = documentKey, sentDocumentVersion = props.documentVersion, sentVersion = modelVersion, sentContext = context;
    try {
      const target = context.redact(props.jobRequirements);
      const safeInstruction = context.instruction + (target ? `\nTarget role (context only, not evidence):\n${target.slice(0, Math.max(0, 4900 - context.instruction.length))}` : "");
      const result = await resumeService.assist(safeInstruction, context.document, context.skills, messages.slice(-10).map(message => ({ ...message, content: sentContext.redact(message.content).slice(0, 1400) })), controller.signal);
      if (!mounted.current || request.current !== controller || controller.signal.aborted || sentVersion !== modelPreferenceRevision()) return;
      applyAssistantProposal(props.document, result, [...result.sections.map(section => `section-${section.section_index}`), ...result.design.map((_, index) => `design-${index}`)], sentContext.mapping);
      setPending({ proposal: result, documentKey: sentKey, documentVersion: sentDocumentVersion, modelVersion: sentVersion, mapping: sentContext.mapping });
      setSelected([...result.sections.map(section => `section-${section.section_index}`), ...result.design.map((_, index) => `design-${index}`)]);
      setMessages(old => [...old, { role: "user", content: context.instruction.slice(0, 3000) }, { role: "assistant", content: result.message }].slice(-10) as AssistantMessage[]);
      setInstruction("");
    } catch (cause) { if (mounted.current && request.current === controller && !controller.signal.aborted) setError(resumeErrorMessage(cause)); }
    finally { if (mounted.current && request.current === controller) { request.current = null; setBusy(false); } }
  };
  const toggle = (id: string, checked: boolean) => setSelected(old => checked ? [...new Set([...old, id])] : old.filter(value => value !== id));
  const titles = Object.keys(props.document.cv.sections ?? {});
  const currentDesign = (path: string[]) => path.join(".") === "theme" ? props.document.design?.theme ?? "classic" : controlFields(props.document, "design").find(field => field.path.join(".") === path.join("."))?.value ?? "Default";
  return <section className={`rw-assistant ${open ? "rw-assistant-open" : ""}`} aria-label="AI resume assistant">
    <div className="rw-assistant-heading"><Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(value => !value)}><MessageSquare size={16} />AI assistant{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</Button>{open && <span>Review changes before applying</span>}</div>
    {open && <div className="rw-assistant-body"><div className="rw-assistant-shortcuts">{suggestions.map(suggestion => <Button key={suggestion} variant="outline" size="sm" disabled={busy} onClick={() => setInstruction(suggestion)}>{suggestion}</Button>)}</div>
      <div className="rw-assistant-messages" role="log" aria-live="polite">{messages.map((message, index) => <p key={index} className={`rw-assistant-message rw-message-${message.role}`}><strong>{message.role === "user" ? "You" : "Assistant"}</strong>{message.content}</p>)}</div>
      {pending && <div className="rw-assistant-proposal"><h3>Suggested changes</h3>{stale && <p className="rb-warning" role="status">This proposal is out of date. Send a new instruction for the current resume.</p>}
        {pending.proposal.sections.map(section => { const id = `section-${section.section_index}`, title = titles[section.section_index] ?? `Section ${section.section_index + 1}`; return <div key={id} className="rw-assistant-change"><label className="rb-check"><Checkbox checked={selected.includes(id)} disabled={stale || busy || Boolean(props.disabledReason)} onCheckedChange={checked => toggle(id, checked === true)} />{title}</label><details><summary>Compare section</summary><div className="rw-assistant-diff"><div><strong>Current</strong><pre>{(props.document.cv.sections?.[title] ?? []).map(entryText).join("\n") || "Empty section"}</pre></div><div><strong>Suggested</strong><pre>{section.entries.map(entry => entryText(restoreAssistantValue(entry.entry, pending.mapping) as ResumeEntry)).join("\n") || "Empty section"}</pre></div></div></details></div>; })}
        {pending.proposal.design.map((change, index) => { const id = `design-${index}`; return <label key={id} className="rb-check rw-assistant-change"><Checkbox checked={selected.includes(id)} disabled={stale || busy || Boolean(props.disabledReason)} onCheckedChange={checked => toggle(id, checked === true)} /><span>{change.path.join(" · ").replaceAll("_", " ")}<strong>{String(currentDesign(change.path))} → {String(change.value ?? "Default")}</strong></span></label>; })}
        <div className="rw-assistant-proposal-actions"><Button size="sm" disabled={!selected.length || stale || busy || Boolean(props.disabledReason)} onClick={() => { if (!pending || pending.documentKey !== documentKey || pending.documentVersion !== props.documentVersion || pending.modelVersion !== modelPreferenceRevision()) return; try { const next = applyAssistantProposal(props.document, pending.proposal, selected, pending.mapping); setReviewed(assistantReviewKey(next, props.skills, extra)); props.apply(next); setPending(null); setSelected([]); } catch (cause) { setError(resumeErrorMessage(cause)); } }}><Sparkles size={14} />Apply selected</Button><Button variant="ghost" size="sm" onClick={() => setPending(null)}>Discard</Button></div>
      </div>}{busy && <p className="rw-assistant-working" role="status">Preparing changes…</p>}
    </div>}
    {props.disabledReason && <p className="rw-assistant-note" role="status">{props.disabledReason}</p>}{error && <p className="rw-assistant-error" role="alert">{error}</p>}
    <div className="rw-assistant-composer"><Textarea aria-label="Ask AI to edit your resume" rows={2} maxLength={4800} value={instruction} disabled={busy || Boolean(props.disabledReason)} placeholder="Ask for changes to your resume…" onFocus={() => setOpen(true)} onChange={event => setInstruction(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /><Button size="icon" aria-label={busy ? "Cancel assistant request" : "Send assistant instruction"} disabled={!busy && (!instruction.trim() || Boolean(props.disabledReason))} onClick={() => busy ? cancel() : void send()}>{busy ? <X /> : <ArrowUp />}</Button></div>
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="rw-assistant-review"><DialogHeader><DialogTitle>Review what AI will receive</DialogTitle><DialogDescription>Personal fields stay local. Check the redacted sections, skills and instruction; remove additional confidential terms before sending.</DialogDescription></DialogHeader><FormField label="Additional private terms (one per line)"><Textarea rows={2} value={extra} maxLength={4000} onChange={event => { setExtra(event.target.value); setReviewAccepted(false); }} /></FormField><FormField label="Redacted context"><Textarea readOnly rows={9} aria-label="Redacted assistant context" value={JSON.stringify({ ...context.document, skills: context.skills, instruction: context.instruction, target_role: context.redact(props.jobRequirements) }, null, 2)} /></FormField><label className="rb-check"><Checkbox checked={reviewAccepted} onCheckedChange={checked => setReviewAccepted(checked === true)} />I reviewed this content and want to send it to AI.</label><p className="rw-assistant-note">Automatic redaction may miss information. Third-party retention policies still apply.</p><DialogFooter><Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button><Button disabled={!reviewAccepted || Boolean(props.disabledReason) || busy} onClick={() => { setReviewed(reviewKey); void send(true); }}>Confirm and send</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

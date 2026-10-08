import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, Textarea } from "@/components/ui/form-field";
import { ROUTES } from "@/constants/routes";

type ResumeProps = { open: boolean; onOpenChange: (open: boolean) => void; entryLabel: string; initialText: string; send: (text: string) => Promise<void> };
export function SendToResumeDialog({ open, onOpenChange, entryLabel, initialText, send }: ResumeProps) {
  // Remount when opened, so the text starts from the latest answer.
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>{open && <ResumeForm key={initialText} {...{ onOpenChange, entryLabel, initialText, send }} />}</DialogContent></Dialog>;
}
function ResumeForm({ onOpenChange, entryLabel, initialText, send }: Omit<ResumeProps, "open">) {
  const [text, setText] = useState(initialText.slice(0, 1200)), [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  const submit = async () => {
    setBusy(true); setError("");
    try { await send(text); setSent(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send this to your resume."); } finally { setBusy(false); }
  };
  return <>
    <DialogHeader><DialogTitle>Send a point to your resume</DialogTitle>
      <DialogDescription>It will show as a suggestion on “{entryLabel}”. Your resume does not change until you accept it in the Resume builder.</DialogDescription></DialogHeader>
    {sent ? <p role="status">Sent. Open the Resume builder to look at it and accept or dismiss it.</p> : <>
      <FormField label="Your words" hint="Keep only what is true. Change or shorten the text if you like."><Textarea rows={6} maxLength={1200} value={text} onChange={event => setText(event.target.value)} /></FormField>
      {error && <p className="ip-note" role="alert">{error}</p>}</>}
    <DialogFooter>
      {sent ? <><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button asChild><Link to={ROUTES.resumeBuilder}>Open Resume builder</Link></Button></>
        : <><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={busy || !text.trim()} onClick={() => { void submit(); }}>{busy ? "Sending…" : "Send suggestion"}</Button></>}
    </DialogFooter>
  </>;
}

type LearningProps = { open: boolean; onOpenChange: (open: boolean) => void; skillName: string; reason: string; question: string; answer: string; roleTitle: string; go: () => Promise<void> };
export function StrengthenDialog({ open, onOpenChange, skillName, reason, question, answer, roleTitle, go }: LearningProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const confirm = async () => {
    setBusy(true); setError("");
    try { await go(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open learning resources."); setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Strengthen {skillName}?</DialogTitle>
      <DialogDescription>This is a practice idea{roleTitle ? ` for ${roleTitle}` : ""}, not proof that you lack the skill. Only continue if you want to learn it.</DialogDescription></DialogHeader>
    <div className="ip-evidence"><p className="ip-hint">Why this was suggested</p><p>{reason}</p><p className="ip-hint">Your question</p><p>{question}</p><p className="ip-hint">Your answer</p><p>{answer.length > 400 ? `${answer.slice(0, 400)}…` : answer}</p></div>
    <p className="ip-hint">We will open learning resources for this skill. Nothing is added to your learning plan until you choose a course.</p>
    {error && <p className="ip-note" role="alert">{error}</p>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Not now</Button><Button disabled={busy} onClick={() => { void confirm(); }}>{busy ? "Opening…" : "Yes, continue to learning"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

import { useState } from "react";
import { ArrowRight, BookOpen, FilePenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-field";
import { compareAttempts, followUpCount, MAX_FOLLOW_UPS, type Attempt, type SessionQuestion } from "@/features/interview/session";
import type { CheckId, CheckStatus, ImprovementKind } from "@/features/interview/types";

const CHECKS: Record<CheckId, string> = {
  answered_question: "Answered the question", own_actions: "Described what you did yourself", concrete_example: "Gave a real example",
  judgement: "Explained where your judgement matters", ai_check: "Said how you check AI output",
};
const STATUS: Record<CheckStatus, string> = { yes: "Yes", partly: "Partly", no: "Not yet", not_applicable: "Not needed" };
const GROUPS: Record<ImprovementKind, { title: string; note?: string }> = {
  expression: { title: "How you said it" },
  missing_example: { title: "Details you could add" },
  possible_skill_gap: { title: "Skills you may want to strengthen", note: "This is a practice idea, not proof that you lack a skill." },
};
type Props = {
  question: SessionQuestion; attempt: Attempt; previous: Attempt | null; skillName: (id: number) => string;
  canSendToResume: boolean; onTryAgain: () => void; onNext: (() => void) | null; onSendToResume: () => void; onStrengthen: () => void;
  onFollowUp: (followUpId: string, reply: { answer?: string; skipped?: boolean; correction?: string }) => void;
};
export default function FeedbackPanel({ question, attempt, previous, skillName, canSendToResume, onTryAgain, onNext, onSendToResume, onStrengthen, onFollowUp }: Props) {
  const feedback = attempt.feedback;
  const [replies, setReplies] = useState<Record<string, string>>({}), [fixing, setFixing] = useState<string | null>(null);
  if (!feedback) return null;
  const compare = previous ? compareAttempts(previous, attempt) : null;
  const gap = feedback.skill_gap;
  return <div className="ip-feedback" aria-label="Feedback on your answer">
    <h3>Feedback</h3>
    <p className="ip-summary">{feedback.summary}</p>
    <ul className="ip-checks">{feedback.checks.map(check => <li key={check.id} className={`ip-check ip-${check.status}`}>
      <span className="ip-check-status">{STATUS[check.status]}</span>
      <div><strong>{CHECKS[check.id]}</strong>{check.quote && <q className="ip-quote">{check.quote}</q>}{check.note && <p>{check.note}</p>}</div>
    </li>)}</ul>
    {(["expression", "missing_example", "possible_skill_gap"] as const).map(kind => {
      const items = feedback.improvements.filter(item => item.kind === kind);
      return items.length ? <section key={kind} className="ip-group"><h4>{GROUPS[kind].title}</h4>{GROUPS[kind].note && <p className="ip-hint">{GROUPS[kind].note}</p>}
        <ul>{items.map((item, index) => <li key={index}>{item.text}{item.quote && <q className="ip-quote">{item.quote}</q>}{item.uncertain && <span className="ip-uncertain"> Not certain. There was too little to tell.</span>}</li>)}</ul></section> : null;
    })}
    {attempt.followUps.map(followUp => <section key={followUp.id} className="ip-followup" aria-label="Follow-up question">
      <h4>One more question</h4><p>{followUp.text}</p>
      {followUp.skipped ? <p className="ip-hint">You skipped this one.</p> : followUp.answer ? <><p className="ip-hint">Your reply</p><p>{followUp.answer}</p></> : <>
        <Textarea rows={3} maxLength={2000} aria-label="Your reply to the follow-up question" value={replies[followUp.id] ?? ""} onChange={event => setReplies(old => ({ ...old, [followUp.id]: event.target.value }))} />
        <div className="ip-actions">
          <Button size="sm" disabled={!(replies[followUp.id] ?? "").trim()} onClick={() => onFollowUp(followUp.id, { answer: replies[followUp.id] })}>Save my reply</Button>
          <Button size="sm" variant="outline" onClick={() => setFixing(fixing === followUp.id ? null : followUp.id)}>That is not what I said</Button>
          <Button size="sm" variant="ghost" onClick={() => onFollowUp(followUp.id, { skipped: true })}>Skip</Button>
        </div>
        {fixing === followUp.id && <div><Textarea rows={2} maxLength={1000} aria-label="What you actually meant" placeholder="Tell us what you meant" value={followUp.correction} onChange={event => onFollowUp(followUp.id, { correction: event.target.value })} /></div>}
      </>}
      {followUp.correction && fixing !== followUp.id && <p className="ip-hint">Your correction: {followUp.correction}</p>}
    </section>)}
    {compare && compare.changes.length > 0 && <section className="ip-group ip-compare" aria-label="Compared with your last answer">
      <h4>Compared with your last answer</h4>
      <ul>{compare.changes.map(change => <li key={change.id}>{CHECKS[change.id]}: {STATUS[change.before]} → {STATUS[change.after]} {change.result === "better" ? "(better)" : change.result === "worse" ? "(less clear this time)" : "(same)"}</li>)}</ul>
      <p className="ip-hint">{compare.addressed.length ? `You covered ${compare.addressed.length} more ${compare.addressed.length === 1 ? "point" : "points"}.` : "No new points were covered this time."} More tries do not mean you are more skilled. This only shows which points you covered.</p>
    </section>}
    {followUpCount(question) >= MAX_FOLLOW_UPS && <p className="ip-hint">You have reached two follow-up questions for this question.</p>}
    <div className="ip-actions ip-feedback-actions">
      <Button variant="outline" onClick={onTryAgain}><RotateCcw size={15} />Try again</Button>
      {canSendToResume && <Button variant="outline" onClick={onSendToResume}><FilePenLine size={15} />Send a point to my resume</Button>}
      {gap && <Button variant="outline" onClick={onStrengthen}><BookOpen size={15} />Strengthen {skillName(gap.skill_id)}</Button>}
      {onNext && <Button onClick={onNext}>Next question<ArrowRight size={15} /></Button>}
    </div>
  </div>;
}

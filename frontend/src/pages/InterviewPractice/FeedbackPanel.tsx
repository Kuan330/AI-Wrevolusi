import { useState } from "react";
import { ArrowRight, BookOpen, FilePenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-field";
import { LEVEL_LABEL, competencyLabel } from "@/features/interview/competencies";
import { compareScores } from "@/features/interview/profile";
import { compareAttempts, followUpCount, MAX_FOLLOW_UPS, type Attempt, type SessionQuestion } from "@/features/interview/session";
import type { CheckId, CheckStatus, ImprovementKind, StructurePart } from "@/features/interview/types";

const CHECKS: Record<CheckId, string> = {
  answered_question: "Answered the question", own_actions: "Described what you did yourself", concrete_example: "Gave a real example",
  judgement: "Explained where your judgement matters", ai_check: "Said how you check AI output",
};
const STATUS: Record<CheckStatus, string> = { yes: "Yes", partly: "Partly", no: "Not yet", not_applicable: "Not needed" };
const PARTS: Record<StructurePart, string> = { situation: "Situation", task: "Task", action: "Your action", result: "Result" };
const GROUPS: Record<ImprovementKind, { title: string; note?: string }> = {
  expression: { title: "How you said it" },
  missing_example: { title: "Details you could add" },
  possible_skill_gap: { title: "Skills you may want to strengthen", note: "This is a practice idea, not proof that you lack a skill." },
};
type Props = {
  question: SessionQuestion; attempt: Attempt; previous: Attempt | null; skillName: (id: number) => string;
  canSendToResume: boolean; onTryAgain: () => void; onUseStronger: (text: string) => void; onNext: (() => void) | null; onSendToResume: () => void; onStrengthen: () => void;
  onFollowUp: (followUpId: string, reply: { answer?: string; skipped?: boolean; correction?: string }) => void;
};
export default function FeedbackPanel({ question, attempt, previous, skillName, canSendToResume, onTryAgain, onUseStronger, onNext, onSendToResume, onStrengthen, onFollowUp }: Props) {
  const feedback = attempt.feedback;
  const [replies, setReplies] = useState<Record<string, string>>({}), [fixing, setFixing] = useState<string | null>(null);
  if (!feedback) return null;
  const compare = previous ? compareAttempts(previous, attempt) : null;
  const gap = feedback.skill_gap;
  const scores = feedback.scores ?? [], structure = (feedback.structure ?? []).filter(part => part.status !== "not_applicable");
  const scoreChanges = previous ? compareScores(previous.feedback?.scores, scores) : [];
  const shortAnswer = attempt.answer.trim().split(/\s+/).length < 20;
  return <div className="ip-feedback" aria-label="Feedback on your answer">
    <section className="ip-answers" aria-label={previous ? "Compare your answers" : "Your submitted answer"}>
      {previous && <div><h4>Previous answer</h4><blockquote>{previous.answer}</blockquote></div>}
      <div><h4>{previous ? "Current answer" : "Your answer"}</h4><blockquote>{attempt.answer}</blockquote></div>
    </section>
    <h3>Feedback</h3>
    <p className="ip-summary">{feedback.summary}</p>
    <ul className="ip-checks">{feedback.checks.map(check => <li key={check.id} className={`ip-check ip-${check.status}`}>
      <span className="ip-check-status">{STATUS[check.status]}</span>
      <div><strong>{CHECKS[check.id]}</strong>{check.quote && <q className="ip-quote">{check.quote}</q>}{check.note && <p>{check.note}</p>}</div>
    </li>)}</ul>
    {scores.length > 0 && <section className="ip-group ip-scores" aria-label="Skills this answer showed">
      <h4>Skills this answer showed</h4>
      <p className="ip-hint">This describes this answer only. It is practice, not a test of you, and not a prediction of an interview.</p>
      <ul className="ip-score-list">{scores.map(score => <li key={score.competency}>
        <div className="ip-score-head"><strong>{competencyLabel(score.competency)}</strong><span className={`ip-level ip-level-${score.level}`}>{LEVEL_LABEL[score.level]}</span></div>
        <meter className="ip-meter" min={1} max={4} value={score.level} aria-label={`${competencyLabel(score.competency)}: ${LEVEL_LABEL[score.level]}`} />
        {score.quote && <q className="ip-quote">{score.quote}</q>}<p>{score.reason}</p>
        {score.next_step && score.level < 4 && <p className="ip-next"><strong>Next level:</strong> {score.next_step}</p>}
      </li>)}</ul>
    </section>}
    {structure.length > 0 && <section className="ip-group" aria-label="Answer structure"><h4>Answer structure</h4>
      <ul className="ip-structure">{structure.map(part => <li key={part.part}><span className={`ip-check-status ip-${part.status}`}>{STATUS[part.status]}</span> {PARTS[part.part]}{part.quote && <q className="ip-quote">{part.quote}</q>}</li>)}</ul></section>}
    {shortAnswer && <p className="ip-hint" role="note">Your answer is short, so scores stay low until there is more to judge. Try three to five sentences: what the situation was, what you did, and what changed.</p>}
    {(["expression", "missing_example", "possible_skill_gap"] as const).map(kind => {
      const items = feedback.improvements.filter(item => item.kind === kind);
      return items.length ? <section key={kind} className="ip-group"><h4>{GROUPS[kind].title}</h4>{GROUPS[kind].note && <p className="ip-hint">{GROUPS[kind].note}</p>}
        <ul>{items.map((item, index) => <li key={index}>{item.text}{item.quote && <q className="ip-quote">{item.quote}</q>}{item.uncertain && <span className="ip-uncertain"> Not certain. There was too little to tell.</span>}</li>)}</ul></section> : null;
    })}
    {feedback.stronger_answer && <section className="ip-group ip-stronger" aria-label="A stronger version">
      <h4>A stronger version, using only your own facts</h4>
      <blockquote>{feedback.stronger_answer}</blockquote>
      <p className="ip-hint">Fill in the [brackets] from real experience. Do not add anything that is not true. This is an example of structure, not an answer to copy.</p>
      <Button size="sm" variant="outline" onClick={() => onUseStronger(feedback.stronger_answer!)}>Use as my next draft</Button>
    </section>}
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
    {scoreChanges.length > 0 && <section className="ip-group ip-compare" aria-label="Skill changes since your last answer"><h4>Skills since your last answer</h4>
      <ul>{scoreChanges.map(change => <li key={change.competency}>{competencyLabel(change.competency)}: {LEVEL_LABEL[change.before]} → {LEVEL_LABEL[change.after]} {change.after > change.before ? "(better)" : change.after < change.before ? "(less clear this time)" : "(same)"}</li>)}</ul></section>}
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

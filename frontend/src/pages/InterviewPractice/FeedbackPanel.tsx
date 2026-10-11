import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, CircleCheck, FilePenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-field";
import { LEVEL_LABEL, competencyLabel } from "@/features/interview/competencies";
import { compareScores } from "@/features/interview/profile";
import LevelBar from "./LevelBar";
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
  question: SessionQuestion; attempt: Attempt; previous: Attempt | null;
  canSendToResume: boolean; onTryAgain: () => void; onUseStronger: (text: string) => void; onNext: (() => void) | null; onFinish: (() => void) | null;
  onSendToResume: () => void; onStrengthen: () => void;
  /** True when this feedback has only just arrived, so focus should move to it. */
  fresh?: boolean;
  onFollowUp: (followUpId: string, reply: { answer?: string; skipped?: boolean; correction?: string }) => void;
};
export default function FeedbackPanel({ question, attempt, previous, canSendToResume, onTryAgain, onUseStronger, onNext, onFinish, onSendToResume, onStrengthen, onFollowUp, fresh }: Props) {
  const title = useRef<HTMLHeadingElement | null>(null);
  // The answer box is gone once feedback arrives, so put focus on the feedback instead of losing it.
  useEffect(() => { if (fresh) title.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const feedback = attempt.feedback;
  const [replies, setReplies] = useState<Record<string, string>>({}), [fixing, setFixing] = useState<string | null>(null);
  if (!feedback) return null;
  const compare = previous ? compareAttempts(previous, attempt) : null;
  const gap = feedback.skill_gap;
  const scores = feedback.scores ?? [], structure = (feedback.structure ?? []).filter(part => part.status !== "not_applicable");
  const scoreChanges = previous ? compareScores(previous.feedback?.scores, scores) : [];
  const shortAnswer = attempt.answer.trim().split(/\s+/).length < 20;
  // Lead with what went well, then one thing to do. Everything else is one tap away.
  // The quotes sit in the skills list below, so repeating them here would read twice.
  const wentWell = [
    ...scores.filter(score => score.level >= 3).map(score => ({ key: score.competency, label: competencyLabel(score.competency), text: score.reason })),
    ...feedback.checks.filter(check => check.status === "yes" && check.id !== "answered_question").map(check => ({ key: check.id, label: CHECKS[check.id], text: "" })),
  ].slice(0, 3);
  const answered = feedback.checks.find(check => check.id === "answered_question");
  // A short answer is already explained by the hint below, so only longer answers get the "answer the question" step.
  const offTopic = answered !== undefined && (answered.status === "no" || (answered.status === "partly" && !shortAnswer));
  const weakest = [...scores].filter(score => score.level < 4 && score.next_step).sort((a, b) => a.level - b.level)[0];
  const doNext = offTopic ? { label: "Answer the question that was asked", text: answered!.note || "Start with a direct answer to the question, then add your example." } : weakest ? { label: competencyLabel(weakest.competency), text: weakest.next_step }
    : (feedback.improvements.find(item => item.kind !== "possible_skill_gap") ? { label: "", text: feedback.improvements.find(item => item.kind !== "possible_skill_gap")!.text } : null);
  return <div className="ip-feedback" aria-label="Feedback on your answer">
    <h3 tabIndex={-1} ref={title}>Feedback</h3>
    <details className="ip-your-answer" open={Boolean(previous)}>
      <summary>{previous ? "Compare your answers" : "Your answer"}</summary>
      <div className="ip-answers">
        {previous && <div><h4>Previous answer</h4><blockquote>{previous.answer}</blockquote></div>}
        <div>{previous && <h4>Current answer</h4>}<blockquote>{attempt.answer}</blockquote></div>
      </div>
    </details>
    <p className="ip-summary">{feedback.summary}</p>
    {(wentWell.length > 0 || doNext) && <section className={`ip-lead${offTopic ? " is-first" : ""}`} aria-label="What went well and what to do next">
      {wentWell.length > 0 && <div className="ip-well"><h4><CircleCheck size={15} aria-hidden="true" /> What went well</h4>
        <ul>{wentWell.map(item => <li key={item.key}><strong>{item.label}</strong>{item.text && <span>: {item.text}</span>}</li>)}</ul></div>}
      {doNext && <div className="ip-todo"><h4>Do this next</h4><p>{doNext.label && <strong>{doNext.label}. </strong>}{doNext.text}</p></div>}
    </section>}
    {shortAnswer && <p className="ip-hint" role="note">Your answer is short, so scores stay low until there is more to judge. Try three to five sentences: what the situation was, what you did, and what changed.</p>}
    {scores.length > 0 && <details className="ip-more" aria-label="Skills this answer showed">
      <summary>Skills this answer showed ({scores.length})</summary>
      <p className="ip-hint">This describes this answer only. It is practice, not a test of you.</p>
      <ul className="ip-score-list">{scores.map(score => <li key={score.competency}>
        <div className="ip-score-head"><strong>{competencyLabel(score.competency)}</strong><span className={`ip-level ip-level-${score.level}`}>{LEVEL_LABEL[score.level]}</span><LevelBar level={score.level} /></div>
        {score.quote && <q className="ip-quote">{score.quote}</q>}<p>{score.reason}</p>
      </li>)}</ul>
    </details>}
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
    {feedback.stronger_answer && <details className="ip-more ip-stronger">
      <summary>See a stronger version, using only your own facts</summary>
      <blockquote>{feedback.stronger_answer}</blockquote>
      <p className="ip-hint">Fill in the [brackets] from real experience. Do not add anything that is not true. It shows structure. Do not copy it.</p>
      <Button size="sm" variant="outline" onClick={() => onUseStronger(feedback.stronger_answer!)}>Use as my next draft</Button>
    </details>}
    <details className="ip-more">
      <summary>All checks and ways to improve</summary>
      <ul className="ip-checks">{feedback.checks.map(check => <li key={check.id} className={`ip-check ip-${check.status}`}>
        <span className="ip-check-status">{STATUS[check.status]}</span>
        <div><strong>{CHECKS[check.id]}</strong>{check.quote && <q className="ip-quote">{check.quote}</q>}{check.note && <p>{check.note}</p>}</div>
      </li>)}</ul>
      {structure.length > 0 && <section className="ip-group" aria-label="Answer structure"><h4>Answer structure</h4>
        <ul className="ip-structure">{structure.map(part => <li key={part.part}><span className={`ip-check-status ip-${part.status}`}>{STATUS[part.status]}</span> {PARTS[part.part]}{part.quote && <q className="ip-quote">{part.quote}</q>}</li>)}</ul></section>}
      {(["expression", "missing_example", "possible_skill_gap"] as const).map(kind => {
        const items = feedback.improvements.filter(item => item.kind === kind);
        return items.length ? <section key={kind} className="ip-group"><h4>{GROUPS[kind].title}</h4>{GROUPS[kind].note && <p className="ip-hint">{GROUPS[kind].note}</p>}
          <ul>{items.map((item, index) => <li key={index}>{item.text}{item.quote && <q className="ip-quote">{item.quote}</q>}{item.uncertain && <span className="ip-uncertain"> Not certain. There was too little to tell.</span>}</li>)}</ul></section> : null;
      })}
    </details>
    {scoreChanges.length > 0 && <section className="ip-group ip-compare" aria-label="Skill changes since your last answer"><h4>Skills since your last answer</h4>
      <ul>{scoreChanges.map(change => <li key={change.competency}>{competencyLabel(change.competency)}: {LEVEL_LABEL[change.before]} → {LEVEL_LABEL[change.after]} {change.after > change.before ? "(better)" : change.after < change.before ? "(less clear this time)" : "(same)"}</li>)}</ul></section>}
    {compare && compare.changes.length > 0 && <section className="ip-group ip-compare" aria-label="Compared with your last answer">
      <h4>Compared with your last answer</h4>
      <ul>{compare.changes.map(change => <li key={change.id}>{CHECKS[change.id]}: {STATUS[change.before]} → {STATUS[change.after]} {change.result === "better" ? "(better)" : change.result === "worse" ? "(less clear this time)" : "(same)"}</li>)}</ul>
      <p className="ip-hint">{compare.addressed.length ? `You covered ${compare.addressed.length} more ${compare.addressed.length === 1 ? "point" : "points"}.` : "No new points were covered this time."}</p>
    </section>}
    {followUpCount(question) >= MAX_FOLLOW_UPS && <p className="ip-hint">You have reached two follow-up questions for this question.</p>}
    <div className="ip-actions ip-feedback-actions">
      {onNext ? <Button onClick={onNext}>Next question<ArrowRight size={15} /></Button> : onFinish ? <Button onClick={onFinish}>Finish and see how you did<ArrowRight size={15} /></Button> : null}
      <Button variant="outline" onClick={onTryAgain}><RotateCcw size={15} />Try again</Button>
      {canSendToResume && <Button variant="outline" onClick={onSendToResume}><FilePenLine size={15} />Send a point to my resume</Button>}
      {gap && <Button variant="outline" onClick={onStrengthen}><BookOpen size={15} />Strengthen this skill</Button>}
    </div>
  </div>;
}

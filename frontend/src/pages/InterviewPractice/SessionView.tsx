import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { NativeSelect } from "@/components/ui/form-field";
import { sendAnswerToResume, startStrengthening } from "@/features/interview/handoff";
import { interviewService } from "@/features/interview/service";
import {
  addAttempt, answerFollowUp, feedbackRoleTitle, followUpCount, nextOpenQuestion, questionDone, reopenQuestion, sessionProgress, setAttemptError, setAttemptFeedback, setDraft, skipQuestion,
  type InterviewSession, type SessionQuestion,
} from "@/features/interview/session";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import AnswerBox from "./AnswerBox";
import FeedbackPanel from "./FeedbackPanel";
import { SendToResumeDialog, StrengthenDialog } from "./HandoffDialogs";
import FinishView from "./FinishView";
import ProfilePanel from "./ProfilePanel";

const dateText = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const TAGS = { resume_item: "From your resume", requirement_practice: "Role requirement. Practice only", ai_change: "AI at work", general: "General practice" } as const;

type Props = { owner: string; session: InterviewSession; allSessions: InterviewSession[]; onChange: (session: InterviewSession) => void; onExit: () => void };
export default function SessionView({ owner, session, allSessions, onChange, onExit }: Props) {
  const navigate = useNavigate();
  const latest = useRef(session);
  useEffect(() => { latest.current = session; });
  const commit = (next: InterviewSession) => { latest.current = next; onChange(next); };
  const [index, setIndex] = useState(() => Math.max(0, nextOpenQuestion(session)));
  const [skills, setSkills] = useState<WefSkill[]>(() => referenceService.cachedWefSkills() ?? []);
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const [again, setAgain] = useState<Record<string, boolean>>({}), [selected, setSelected] = useState<Record<string, string>>({});
  const [resumeOpen, setResumeOpen] = useState(false), [learnOpen, setLearnOpen] = useState(false);
  const [finished, setFinished] = useState(() => sessionProgress(session).complete), [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement | null>(null), firstRender = useRef(true);
  const request = useRef<AbortController | null>(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  // After moving to another question, put focus on its heading so keyboard and screen reader users start there.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [index]);
  useEffect(() => {
    const controller = new AbortController();
    referenceService.wefSkills().then(list => { if (!controller.signal.aborted) setSkills(list); }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const question = session.questions[index] as SessionQuestion | undefined;
  const progress = sessionProgress(session);
  const attempt = question?.attempts.find(entry => entry.id === selected[question.id]) ?? question?.attempts.at(-1) ?? null;
  const attemptIndex = question && attempt ? question.attempts.indexOf(attempt) : -1;
  const previous = question && attemptIndex > 0 ? question.attempts[attemptIndex - 1] : null;
  const item = question?.itemId ? session.items.find(entry => entry.id === question.itemId) ?? null : null;
  const skillName = (id: number) => skills.find(skill => skill.wef_skill_id === id)?.core_skill ?? "this skill";
  const draft = question?.draft ?? "";
  const editing = question ? again[question.id] ?? Boolean(draft) : false;

  // Keep an unsent answer, so a pause or reload does not lose it.
  const changeDraft = (value: string) => {
    if (!question) return;
    commit(setDraft(latest.current, question.id, value));
  };

  const askFeedback = async (questionId: string, attemptId: string) => {
    const current = latest.current.questions.find(entry => entry.id === questionId);
    const target = current?.attempts.find(entry => entry.id === attemptId);
    if (!current || !target) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(attemptId); setError("");
    try {
      const result = await interviewService.feedback({
        question: { text: current.sentText, kind: current.kind, item_label: null, intent: current.intent ?? null }, answer: target.answer, role_title: feedbackRoleTitle(latest.current),
        attempt: current.attempts.findIndex(entry => entry.id === attemptId) + 1, follow_ups_asked: Math.min(followUpCount(current), 2),
        skills: skills.map(skill => ({ id: skill.wef_skill_id, name: skill.core_skill })),
      }, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      commit(setAttemptFeedback(latest.current, questionId, attemptId, result));
      setNotice("Your feedback is ready.");
    } catch (cause) {
      if (!alive.current || controller.signal.aborted) return;
      const message = cause instanceof Error ? cause.message : "Feedback could not be prepared. Your answer is saved.";
      // The saved answer shows this message beside its retry button.
      try { commit(setAttemptError(latest.current, questionId, attemptId, message)); } catch { setError(message); }
    } finally { if (alive.current && request.current === controller) { request.current = null; setBusy(""); } }
  };
  const submit = (mode: "text" | "voice") => {
    if (!question) return;
    try {
      const { session: next, attemptId } = addAttempt(latest.current, question.id, { answer: draft, mode });
      commit(next);
      setSelected(old => ({ ...old, [question.id]: attemptId }));
      setAgain(old => ({ ...old, [question.id]: false }));
      void askFeedback(question.id, attemptId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Add your answer first."); }
  };
  const go = (next: number) => { setIndex(next); setError(""); setNotice(""); setResumeOpen(false); setLearnOpen(false); };
  const nextIndex = nextOpenQuestion(session, index);
  const editAnswer = () => {
    if (!question || !attempt) return;
    changeDraft(attempt.answer);
    setAgain(old => ({ ...old, [question.id]: true }));
  };

  const useStronger = (text: string) => {
    if (!question) return;
    changeDraft(text);
    setAgain(old => ({ ...old, [question.id]: true }));
  };

  const career = session.role.occupationCode ? { code: session.role.occupationCode, title: session.role.title } : null;
  const strengthen = async () => {
    const gap = attempt?.feedback?.skill_gap;
    if (!gap) return;
    navigate(await startStrengthening({ skill: { id: gap.skill_id, name: skillName(gap.skill_id) }, career, roleTitle: session.role.title }));
  };

  return <div className="ip-session">
    <div className="ip-topbar">
      <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft size={15} />All practice</Button>
      <div className="ip-context"><strong>{session.role.title}</strong>
        <span>{session.mode === "resume" && session.resumeVersion ? `Based on your resume reviewed on ${dateText(session.resumeVersion.reviewedAt)}` : session.mode === "career" ? "Based on your selected future occupation. No resume needed" : "General practice. Not based on your resume"}</span></div>
      <div className="ip-progress"><Progress value={progress.total ? Math.round((progress.answered + progress.skipped) * 100 / progress.total) : 0} aria-label="Practice progress" />
        <span>{progress.answered} answered{progress.skipped ? `, ${progress.skipped} skipped` : ""} of {progress.total}</span></div>
    </div>
    <nav className="ip-steps" aria-label="Questions">{session.questions.map((entry, position) => <button key={entry.id} type="button" aria-current={position === index ? "step" : undefined}
      className={`ip-step ${questionDone(entry) ? (entry.skipped ? "is-skipped" : "is-done") : ""}`} onClick={() => go(position)}>
      <span className="sr-only">Question </span>{position + 1}{questionDone(entry) && !entry.skipped && <Check size={11} aria-hidden="true" />}{entry.skipped ? <span className="sr-only"> skipped</span> : questionDone(entry) ? <span className="sr-only"> answered</span> : null}</button>)}</nav>
    {error && <div className="ip-note" role="alert">{error}</div>}
    <p className="sr-only" role="status">{notice}</p>
    {progress.complete && finished && <>
      <FinishView session={session} onExit={onExit} onReview={() => setFinished(false)} />
      <ProfilePanel sessions={allSessions} />
    </>}
    {question && !(progress.complete && finished) && <Card className="ip-question">
      <p className="ip-tag">{session.mode === "career" && question.kind === "general" ? "Future occupation practice" : TAGS[question.kind]}{question.itemLabel ? ` · ${question.itemLabel}` : ""}</p>
      <h2 ref={heading} tabIndex={-1}>{question.text}</h2>
      <p className="ip-hint">This is a practice question. It is not the employer’s question.</p>
      {question.attempts.length > 1 && <label className="ip-history">Review an answer
        <NativeSelect value={attempt?.id ?? ""} onChange={event => { setNotice(""); setSelected(old => ({ ...old, [question.id]: event.target.value })); setAgain(old => ({ ...old, [question.id]: false })); setResumeOpen(false); setLearnOpen(false); }}>
          {question.attempts.map((entry, position) => <option key={entry.id} value={entry.id}>Attempt {position + 1}{entry.feedback ? " · feedback ready" : entry.error ? " · feedback failed" : " · awaiting feedback"}</option>)}
        </NativeSelect>
      </label>}
      {question.skipped ? <div className="ip-actions"><p>You skipped this question.</p><Button variant="outline" onClick={() => commit(reopenQuestion(latest.current, question.id))}>Answer it anyway</Button></div>
        : attempt && attempt.feedback && !editing ? <FeedbackPanel key={attempt.id} question={question} attempt={attempt} previous={previous} canSendToResume={Boolean(item?.ref)}
            onTryAgain={editAnswer} onUseStronger={useStronger}
            onNext={nextIndex >= 0 && nextIndex !== index ? () => go(nextIndex) : null} onFinish={progress.complete ? () => setFinished(true) : null} fresh={notice !== ""} onSendToResume={() => setResumeOpen(true)} onStrengthen={() => setLearnOpen(true)}
            onFollowUp={(id, reply) => commit(answerFollowUp(latest.current, question.id, attempt.id, id, reply))} />
        : attempt && !attempt.feedback && !editing ? <div className="ip-retry">{attempt.error && <p className="ip-note" role="alert">{attempt.error}</p>}
            <p className="ip-hint">Your answer is saved:</p><blockquote>{attempt.answer}</blockquote>
            {busy === attempt.id ? <div className="ip-waiting" role="status"><p>Reading your answer. This can take up to a minute.</p>
              <Button variant="ghost" size="sm" onClick={() => request.current?.abort()}>Stop waiting</Button></div> : <div className="ip-actions"><Button disabled={Boolean(busy)} onClick={() => { void askFeedback(question.id, attempt.id); }}>Try feedback again</Button>
              <Button variant="outline" disabled={Boolean(busy)} onClick={editAnswer}>Edit my answer</Button></div>}</div>
        : <>{attempt && editing && attempt.feedback && <p className="ip-hint">Improve your last answer, then submit it again to compare.</p>}
            <AnswerBox key={question.id} value={draft} onChange={changeDraft} onSubmit={submit} busy={Boolean(busy)} /></>}
      {!question.skipped && !(attempt?.feedback && !editing) && <div className="ip-actions"><Button variant="ghost" size="sm" onClick={() => {
          const next = skipQuestion(latest.current, question.id);
          commit(next);
          if (sessionProgress(next).complete) setFinished(true); else if (nextIndex >= 0 && nextIndex !== index) go(nextIndex);
        }}><SkipForward size={14} />Skip this question</Button></div>}
    </Card>}
    {item?.ref && attempt && <SendToResumeDialog open={resumeOpen} onOpenChange={setResumeOpen} entryLabel={item.label} initialText={attempt.answer}
      send={text => sendAnswerToResume(owner, { sessionId: session.id, questionId: question!.id, attemptId: attempt.id, question: question!.text, item, text })} />}
    {attempt?.feedback?.skill_gap && question && <StrengthenDialog open={learnOpen} onOpenChange={setLearnOpen} skillName={skillName(attempt.feedback.skill_gap.skill_id)}
      reason={attempt.feedback.skill_gap.reason} question={question.text} answer={attempt.answer} roleTitle={session.role.title} go={strengthen} />}
  </div>;
}

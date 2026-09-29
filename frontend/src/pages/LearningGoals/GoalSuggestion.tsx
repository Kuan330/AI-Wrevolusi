import { useEffect, useRef, useState } from "react";
import { guidedLearningService, type GuidedGoalSuggestion } from "@/services/guidedLearningService";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { templateGoalSuggestion, suggestedActivityText } from "@/features/learning-goals/guidedLearning";
import type { LearningGoal } from "@/features/learning-goals/learningGoals";

type Props = { goal: LearningGoal; incoming?: GuidedGoalSuggestion; disabled: boolean; onGoal: (text: string) => Promise<boolean>; onAction: (text: string, origin: "ai_suggestion" | "template") => Promise<boolean> };
export default function GoalSuggestion({ goal, incoming, disabled, onGoal, onAction }: Props) {
  const [suggestion, setSuggestion] = useState<GuidedGoalSuggestion>(() => incoming?.goal_id === goal.id && incoming.revision === goal.revision ? incoming : templateGoalSuggestion(goal));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const latest = useRef(goal.revision);
  latest.current = goal.revision;
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  async function another() {
    if (pending || disabled) return;
    const owner = currentWorkspaceSession(); const revision = goal.revision;
    setPending(true); setError(""); request.current = new AbortController();
    try {
      const next = await guidedLearningService.forGoal(goal.id, revision, request.current.signal);
      if (!alive.current || owner !== currentWorkspaceSession() || latest.current !== revision) return;
      if (next.goal_id !== goal.id || next.revision !== revision) throw new Error("Your goal changed. Please request another suggestion.");
      setSuggestion(next);
    } catch (e) {
      if (!alive.current || owner !== currentWorkspaceSession()) return;
      setError(e instanceof Error ? e.message : "A tailored suggestion could not be prepared.");
      if (latest.current === revision) setSuggestion(templateGoalSuggestion(goal, true));
    } finally { if (alive.current && owner === currentWorkspaceSession()) setPending(false); }
  }
  const savedActivityText = suggestedActivityText(suggestion);
  return <section className="lg-card lg-guided" aria-label="Suggested next step">
    <p className="lg-eyebrow">{suggestion.source === "model" ? "AI suggestion for your review" : "A simple starting idea"}</p>
    <h2>A ready starting point</h2><p>{suggestion.notice}</p>
    {error && <p role="alert">{error} A general starting idea is shown below.</p>}
    <h3>Suggested goal</h3><p>{suggestion.goal}</p>
    <button disabled={disabled || pending || suggestion.goal === goal.wording} onClick={() => void onGoal(suggestion.goal)}>Use this goal</button>
    <h3>One small activity</h3><p>{suggestion.action.text}</p>
    {suggestion.practice_idea !== suggestion.action.text && <><h3>Practice example</h3><p>{suggestion.practice_idea}</p>{savedActivityText === suggestion.action.text && <p className="lg-muted">The saved plan will contain the short activity above. This longer example stays here for you to read.</p>}</>}
    <p className="lg-muted">Save this as a plan. Only record it as an attempt after you have tried it. Your existing records stay unchanged until you choose to save.</p>
    <div className="lg-buttons"><button className="lg-primary" disabled={disabled || pending || goal.action?.text === savedActivityText} onClick={() => void onAction(savedActivityText, suggestion.source === "model" ? "ai_suggestion" : "template")}>Try this activity</button><button disabled={disabled || pending} onClick={() => void another()}>{pending ? "Preparing another idea…" : "Show another"}</button></div>
  </section>;
}

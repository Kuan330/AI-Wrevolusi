import { useEffect, useRef, useState } from "react";
import { guidedLearningService, type GuidedGoalSuggestion } from "@/services/guidedLearningService";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { templateGoalSuggestion, suggestedActivityText } from "@/features/learning-goals/guidedLearning";
import { cleanDisplayText, cleanMultilineDisplayText } from "@/lib/displayText";
import type { LearningGoal } from "@/features/learning-goals/learningGoals";

type Props = { goal: LearningGoal; incoming?: GuidedGoalSuggestion; disabled: boolean; onGoal: (text: string) => Promise<boolean>; onAction: (text: string, origin: "ai_suggestion" | "template") => Promise<boolean> };
export default function GoalSuggestion({ goal, incoming, disabled, onGoal, onAction }: Props) {
  const [suggestion, setSuggestion] = useState<GuidedGoalSuggestion>(() => incoming?.goal_id === goal.id && incoming.revision === goal.revision ? incoming : templateGoalSuggestion(goal));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const latest = useRef(goal.revision);
  useEffect(() => { latest.current = goal.revision; }, [goal.revision]);
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
  const content = <>
    <p className="lg-eyebrow">{suggestion.source === "model" ? "AI suggested activity" : "Sample activity"}</p>
    {error && <p role="alert">A tailored idea is unavailable. You can use the sample activity or try again.</p>}
    <h2>Try one small example</h2><p className="lg-preserve">{cleanMultilineDisplayText(suggestion.action.text)}</p>
    {suggestion.practice_idea !== suggestion.action.text && <details><summary>See the example</summary><p className="lg-preserve">{cleanMultilineDisplayText(suggestion.practice_idea)}</p></details>}
    <div className="lg-buttons"><button className="lg-primary" disabled={disabled || pending || goal.action?.text === savedActivityText} onClick={() => void onAction(savedActivityText, suggestion.source === "model" ? "ai_suggestion" : "template")}>Save as my next action</button><button disabled={disabled || pending} onClick={() => void another()}>{pending ? "Preparing another idea…" : "Show another idea"}</button></div>
    <p className="lg-muted">{cleanDisplayText(suggestion.notice)} Save it as a plan, then record an attempt after you try it.</p>
    <details><summary>Change my goal to fit this idea</summary><p>{cleanDisplayText(suggestion.goal)}</p><button disabled={disabled || pending || suggestion.goal === goal.wording} onClick={() => void onGoal(suggestion.goal)}>Use this goal wording</button></details>
  </>;
  return goal.action
    ? <details className="lg-card lg-guided lg-alternatives"><summary>Other activity ideas</summary>{content}</details>
    : <section className="lg-card lg-guided" aria-label="Suggested next step">{content}</section>;
}

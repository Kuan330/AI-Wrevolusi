import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { guidedLearningService, type GuidedTaskSuggestions, type GuidedSkillSuggestion } from "@/services/guidedLearningService";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { readSpecialistState, saveSpecialistEntry, specialistEntryKey, specialistEntryIsCurrent } from "@/features/journey/specialistSkills";
import { readJourneyProfile } from "@/features/journey/journey";
import { createSpecialistGoal, readLearningGoals, goalContextWarnings } from "@/features/learning-goals/learningGoals";
import { taskSuggestionsAreCurrent, hasMaterialGoalWarnings } from "@/features/learning-goals/guidedLearning";

type Props = { task: { id: string; wording: string }; occupationCode: string | null; disabled: boolean; onBusyChange: (busy: boolean) => void; onVersion: (version: string) => void };
export default function GuidedSkillSuggestions({ task, occupationCode, disabled, onBusyChange, onVersion }: Props) {
  const navigate = useNavigate();
  const [result, setResult] = useState<GuidedTaskSuggestions | null>(null);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  async function suggest() {
    if (lock.current || disabled) return;
    lock.current = true; setPending(true); setError("");
    const owner = currentWorkspaceSession();
    controller.current = new AbortController();
    try {
      const response = await guidedLearningService.forTask(task, controller.current.signal);
      if (!mounted.current || owner !== currentWorkspaceSession()) return;
      if (!taskSuggestionsAreCurrent(response, task)) throw new Error("The suggestions do not match this saved task. Please try again.");
      setResult(response); onVersion(response.version);
    } catch (e) {
      if (mounted.current && owner === currentWorkspaceSession()) setError(e instanceof Error ? e.message : "Suggestions could not be prepared. Please retry or use the optional search.");
    } finally { lock.current = false; if (mounted.current && owner === currentWorkspaceSession()) setPending(false); }
  }
  async function develop(item: GuidedSkillSuggestion) {
    if (lock.current || disabled || !result) return;
    const owner = currentWorkspaceSession();
    lock.current = true; setSaving(true); setError(""); onBusyChange(true);
    try {
      const profile = readJourneyProfile();
      if (!profile.tasksConfirmed || !profile.tasks.some(t => t.id === task.id && t.wording === task.wording)) throw new Error("Your task changed. Review your saved work before choosing this suggestion.");
      const existing = readSpecialistState().entries.find(entry => entry.taskId === task.id && entry.skillUri === item.skill.uri && specialistEntryIsCurrent(entry, profile.tasks, occupationCode));
      await saveSpecialistEntry({ taskId: task.id, taskWording: task.wording, occupationCode, skillUri: item.skill.uri, skillLabel: item.skill.label,
        sourceVersion: result.version, sourceOccupationUri: existing?.sourceOccupationUri ?? null, decision: existing?.decision ?? null, wantsLearning: true });
      if (!mounted.current || owner !== currentWorkspaceSession()) return;
      const entry = readSpecialistState().entries.find(e => e.taskId === task.id && e.skillUri === item.skill.uri);
      if (!entry) throw new Error("Your learning choice could not be found. Please try again.");
      const sourceKey = `specialist:${specialistEntryKey(entry)}`;
      const existingGoal = [...readLearningGoals()].reverse().find(goal => goal.sourceKey === sourceKey);
      const goal = existingGoal ?? await createSpecialistGoal(entry);
      if (!mounted.current || owner !== currentWorkspaceSession()) return;
      if (existingGoal && hasMaterialGoalWarnings(goalContextWarnings(existingGoal))) {
        navigate(`${ROUTES.learningGoals}?goal=${encodeURIComponent(goal.id)}`, { state: { guidedNotice: "Your earlier goal keeps its original context. Review the warning before choosing a new starting point." } });
        return;
      }
      navigate(`${ROUTES.learningGoals}?goal=${encodeURIComponent(goal.id)}`, { state: { guidedGoal: { goal_id: goal.id, revision: goal.revision, source: "model", goal: item.goal, action: item.action, practice_idea: item.practice_idea, notice: result.notice } } });
    } catch (e) {
      if (mounted.current && owner === currentWorkspaceSession()) setError(e instanceof Error ? e.message : "The learning goal could not be saved. Your previous records are unchanged.");
    } finally {
      lock.current = false;
      if (mounted.current && owner === currentWorkspaceSession()) { setSaving(false); onBusyChange(false); }
    }
  }
  return <div className="specialist-skills__guided">
    <h3>Find a useful skill to develop</h3>
    <p>We can read your full saved task and suggest up to three skills with a starting activity. You decide what fits.</p>
    <details><summary>The task we will use</summary><p className="specialist-skills__full-task">{task.wording}</p></details>
    <p className="specialist-skills__reason">This uses AI to review catalogue candidates. Do not include confidential workplace information in your task.</p>
    <Button disabled={disabled || pending || saving} onClick={() => void suggest()}>{pending ? "Preparing suggestions…" : result ? "Show other suggestions" : "Suggest skills for this task"}</Button>
    {error && <p role="alert">{error} You can retry or use the optional catalogue search.</p>}
    {result && <>
      <p role="status">{result.status === "no_supported_match" || !result.suggestions.length ? "We could not support a suggestion for this task. You can browse the catalogue or keep your own skill." : "Suggested for your review"}</p>
      {result.coverage.message && <p className="specialist-skills__reason">{result.coverage.message}</p>}
      <div className="specialist-skills__cards">{result.suggestions.map(item => <article key={item.skill.uri} className="specialist-skills__card">
        <h4>{item.skill.label}</h4><p>{item.reason}</p>
        <p className="specialist-skills__reason"><strong>From your task:</strong> “{item.task_quote}”</p>
        <p><strong>Starting activity:</strong> {item.practice_idea}</p>
        <details><summary>Skill meaning and source</summary><p>{item.skill.description}</p><p>ESCO {result.version} · {item.skill.skill_type}. AI suggested this connection. It is not a verified skill or evidence of mastery.</p><a href={item.skill.uri} target="_blank" rel="noreferrer">Read the source concept</a></details>
        <Button disabled={disabled || pending || saving} onClick={() => void develop(item)}>{saving ? "Saving…" : "Develop this skill"}</Button>
      </article>)}</div>
      <p className="specialist-skills__reason">{result.notice} Choosing a learning goal does not say that you already use this skill.</p>
    </>}
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { readSpecialistState } from "@/features/journey/specialistSkills";
import { readLearningGoals } from "@/features/learning-goals/learningGoals";
import type { ProfileTask } from "@/features/work-profile/types";
import type { PersonalSkill } from "@/features/journey/journey";
import { specialistSkillService, type SpecialistSkill } from "@/services/specialistSkillService";
import type { SkillEvidence } from "../../../features/skills/skillProfile.ts";
import { buildSkillsOverview } from "../lib/skillsOverview";
import { cleanDisplayText, shortTaskLabel } from "@/lib/displayText";

type CandidateSet = { taskId: string; taskWording: string; version: string; skills: SpecialistSkill[] };
type Props = { tasks: ProfileTask[]; occupationCode: string | null; personal: PersonalSkill[]; evidence: SkillEvidence[]; decisions: Record<number, "accepted" | "rejected" | undefined>; broadNeedsReview: boolean; onReview: (id: string) => void };

/** Overview across confirmed tasks. Catalogue results are suggestions, not assessed abilities. */
export default function SkillsOverview({ tasks, occupationCode, personal, evidence, decisions, broadNeedsReview, onReview }: Props) {
  const owner = currentWorkspaceSession();
  const taskKey = JSON.stringify(tasks.map(task => [task.id, task.wording]));
  const context = JSON.stringify([owner, occupationCode, taskKey]);
  const [result, setResult] = useState<{ context: string; candidates: CandidateSet[]; version: string | null; failed: string[]; skipped: string[]; loading: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(6);
  useEffect(() => {
    const controller = new AbortController();
    const snapshot = JSON.parse(taskKey) as [string, string][];
    const searchable = snapshot.filter(([, wording]) => wording.length <= 300);
    const skipped = snapshot.filter(([, wording]) => wording.length > 300).map(([id]) => id);
    const state = { context, candidates: [] as CandidateSet[], version: null as string | null, failed: [] as string[], skipped, loading: true };
    setResult({ ...state });
    let next = 0;
    const publish = () => { if (!controller.signal.aborted && owner === currentWorkspaceSession()) setResult({ ...state, candidates: [...state.candidates], failed: [...state.failed] }); };
    async function worker() {
      while (!controller.signal.aborted && next < searchable.length) {
        const [taskId, taskWording] = searchable[next++];
        try {
          const response = await specialistSkillService.skills(taskWording, 0, controller.signal);
          if (controller.signal.aborted || owner !== currentWorkspaceSession()) return;
          state.version = response.version;
          state.candidates.push({ taskId, taskWording, version: response.version, skills: response.items.slice(0, 3) });
        } catch { if (!controller.signal.aborted) state.failed.push(taskId); }
        publish();
      }
    }
    void Promise.all([worker(), worker()]).then(async () => {
      if (controller.signal.aborted || owner !== currentWorkspaceSession()) return;
      // With only long tasks, a small catalogue read still checks saved source versions.
      if (!searchable.length) {
        try { state.version = (await specialistSkillService.skills("", 0, controller.signal)).version; }
        catch { if (!controller.signal.aborted) state.failed.push(...skipped); }
      }
      state.loading = false; publish();
    });
    return () => controller.abort();
  }, [taskKey, context, owner, retry]);
  const current = result?.context === context ? result : null;
  let storedError = "";
  let saved: ReturnType<typeof readSpecialistState> = { version: 1, entries: [], focusKey: null };
  let goals: ReturnType<typeof readLearningGoals> = [];
  try { saved = readSpecialistState(); goals = readLearningGoals(); }
  catch { storedError = "Some saved choices could not be read. They have been kept. Reload your saved account before making changes."; }
  const overview = buildSkillsOverview({ tasks, occupationCode, specialist: saved.entries, personal, broad: evidence, decisions, broadNeedsReview, candidates: current?.candidates ?? [], goals, catalogueVersion: current?.version ?? null });
  const savedCount = new Set([...saved.entries.map(entry => `esco:${entry.skillUri}`), ...personal.map(entry => `personal:${entry.id}`), ...evidence.filter(item => decisions[item.skill.wef_skill_id]).map(item => `wef:${item.skill.wef_skill_id}`)]).size;
  const learningCount = overview.rows.filter(row => row.wantsLearning).length;
  const visible = useMemo(() => overview.rows.filter(row =>
    (filter === "all" || filter === "work" && row.confirmed || filter === "learning" && row.wantsLearning || filter === "review" && (row.suggested || row.needsReview || row.sourceCheck)) &&
    cleanDisplayText(row.label).toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => {
      const priority = (row: typeof a) => row.goalIds.length || row.wantsLearning || row.tasks.some(task => task.decision) ? 0 : row.source === "wef" ? 1 : 2;
      return priority(a) - priority(b) || a.label.localeCompare(b.label);
    }), [overview.rows, filter, query]);
  if (!tasks.length) return null;
  return <section className="skills-overview" aria-label="Skills across your work">
    <div className="skills-overview__heading"><div><h2>Your skills across your work</h2><p>Saved choices and suggestions from all {tasks.length} confirmed {tasks.length === 1 ? "task" : "tasks"}.</p></div><Button variant="outline" onClick={() => onReview(tasks[0].id)}>Review a task</Button></div>
    <dl className="skills-overview__counts"><div><dt>Saved skill choices</dt><dd>{savedCount}</dd></div><div><dt>Suggestions to review</dt><dd>{overview.counts.suggested}</dd></div><div><dt>Learning interests</dt><dd>{learningCount}</dd></div></dl>
    <p className="skills-overview__hint">Suggestions are ideas to check, not skills assigned to you. Earlier choices stay visible with a review label.</p>
    {storedError && <p role="alert">{storedError}</p>}
    {(!current || current.loading) && <p role="status">Finding suggestions across your tasks. Saved choices stay visible.</p>}
    {current && !current.loading && current.failed.length > 0 && <div className="skills-overview__status" role="status"><p>Some new suggestions are unavailable. Your saved skills are still shown, with source checks marked where needed.</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry suggestions</Button></div>}
    <div className="skills-overview__filters" role="group" aria-label="Filter skill overview">{[["all", "All entries"], ["work", "Fits my work"], ["learning", "To develop"], ["review", "To review"]].map(([value, label]) => <Button key={value} variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(6); }}>{label}</Button>)}</div>
    <label className="skills-overview__search">Find a skill in this overview<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(6); }} /></label>
    {!visible.length ? <p>{query || filter !== "all" ? "No entries match this view. Try All entries or another search." : current?.loading ? "Checking your task wording…" : "No saved skills or supported suggestions yet. Review a task to search the catalogue or add a skill in your own words."}</p> : <ul className="skills-overview__grid">{visible.slice(0, limit).map(row => <li key={row.key}>
      <h3>{cleanDisplayText(row.label)}</h3><p className="skills-overview__source">{row.source === "esco" ? row.kind === "knowledge" ? "ESCO knowledge area" : "ESCO concept" : row.source === "wef" ? "WEF broad skill" : "Your own skill entry"}</p>
      <div className="skills-overview__labels">{row.confirmed && <span>{row.source === "wef" ? "Fits my work" : "Reported use"}</span>}{row.wantsLearning && <span>To develop</span>}{row.suggested && <span>Suggestion to review</span>}{row.tasks.some(task => !task.needsReview && (task.decision === "no" || task.decision === "rejected")) && <span>Marked as not fitting a task</span>}{row.tasks.some(task => !task.needsReview && task.decision === "unsure") && <span>Not sure yet</span>}{row.needsReview && <span>Work connection needs review</span>}{row.sourceCheck && <span>Source check needed</span>}</div>
      <p>From {row.currentTaskIds.length} current {row.currentTaskIds.length === 1 ? "task" : "tasks"}</p>
      <details><summary>Tasks and saved choices</summary><ul>{row.tasks.map(task => <li key={JSON.stringify([task.id, task.wording, task.sourceVersion, task.needsReview])}><p>{shortTaskLabel(task.wording, 120)}</p><p className="skills-overview__hint">{task.needsReview ? "Earlier work, needs review" : task.decision === "use" ? "You reported using this" : task.decision === "accepted" ? "You said this fits your work" : task.decision === "no" || task.decision === "rejected" ? "You said this does not fit" : task.decision === "unsure" ? "You were not sure" : "Suggested from wording, not confirmed"}{task.wantsLearning ? " · Learning interest" : ""}</p><Button variant="outline" disabled={task.needsReview} onClick={() => onReview(task.id)}>Review this task</Button></li>)}</ul></details>
      {row.goalIds.length > 0 && <Link to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(row.goalIds[0])}`}>Open saved goal</Link>}
    </li>)}</ul>}
    {visible.length > limit && <Button variant="outline" onClick={() => setLimit(value => value + 6)}>Show more entries</Button>}
    <details className="skills-overview__coverage"><summary>Review coverage across {tasks.length} {tasks.length === 1 ? "task" : "tasks"}</summary><ul>{tasks.map(task => <li key={task.id}><div><strong>{shortTaskLabel(task.wording)}</strong><p>{overview.rows.filter(row => row.tasks.some(link => link.id === task.id && !link.needsReview)).length} skill entries connected{current?.skipped.includes(task.id) ? " · Review this longer task to choose a search focus" : current?.failed.includes(task.id) ? " · New suggestions unavailable" : ""}</p></div><Button variant="outline" onClick={() => onReview(task.id)}>Review this task</Button></li>)}</ul></details>
  </section>;
}

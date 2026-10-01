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
type OverviewRow = ReturnType<typeof buildSkillsOverview>["rows"][number];
const FILTERS = [["all", "All entries"], ["work", "Fits my work"], ["learning", "To develop"], ["review", "To review"]] as const;
function inFilter(row: OverviewRow, filter: string) {
  return filter === "all" || filter === "work" && row.confirmed || filter === "learning" && row.wantsLearning || filter === "review" && (row.suggested || row.needsReview || row.sourceCheck);
}

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
  const visible = useMemo(() => overview.rows.filter(row =>
    inFilter(row, filter) &&
    cleanDisplayText(row.label).toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => {
      const priority = (row: typeof a) => row.goalIds.length || row.wantsLearning || row.tasks.some(task => task.decision) ? 0 : row.source === "wef" ? 1 : 2;
      return priority(a) - priority(b) || a.label.localeCompare(b.label);
    }), [overview.rows, filter, query]);
  if (!tasks.length) return null;
  return <section className="skills-overview" aria-label="Skills across your work">
    <div className="skills-overview__heading"><div><h2>Your skills across your work</h2><p>Saved choices and suggestions from all {tasks.length} confirmed {tasks.length === 1 ? "task" : "tasks"}.</p></div><Button variant="outline" onClick={() => onReview(tasks[0].id)}>Review a task</Button></div>
    {storedError && <p role="alert">{storedError}</p>}
    {(!current || current.loading) && <p role="status">Finding suggestions across your tasks. Saved choices stay visible.</p>}
    {current && !current.loading && current.failed.length > 0 && <div className="skills-overview__status" role="status"><p>Some new suggestions are unavailable. Your saved skills are still shown, with source checks marked where needed.</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry suggestions</Button></div>}
    <div className="skills-overview__toolbar">
      <div className="skills-overview__filters" role="group" aria-label="Filter skill overview">{FILTERS.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(6); }}>{label} <span>{overview.rows.filter(row => inFilter(row, value)).length}</span></button>)}</div>
      <label className="skills-overview__search"><span className="sr-only">Find a skill</span><input type="search" placeholder="Find a skill" value={query} onChange={event => { setQuery(event.target.value); setLimit(6); }} /></label>
    </div>
    {!visible.length ? <p>{query || filter !== "all" ? "No entries match this view. Try All entries or another search." : current?.loading ? "Checking your task wording…" : "No saved skills or supported suggestions yet. Review a task to search the catalogue or add a skill in your own words."}</p> : <ul className="skills-overview__grid">{visible.slice(0, limit).map(row => <li key={row.key}>
      <h3>{cleanDisplayText(row.label)}</h3>
      <p className="skills-overview__labels">{row.confirmed && <span>{row.source === "wef" ? "Fits my work" : "Reported use"}</span>}{row.wantsLearning && <span>To develop</span>}{row.suggested && <span className="is-review">Suggestion to review</span>}{row.tasks.some(task => !task.needsReview && (task.decision === "no" || task.decision === "rejected")) && <span>Marked as not fitting a task</span>}{row.tasks.some(task => !task.needsReview && task.decision === "unsure") && <span>Not sure yet</span>}{row.needsReview && <span className="is-review">Work connection needs review</span>}{row.sourceCheck && <span className="is-review">Source check needed</span>}</p>
      <details><summary>{row.currentTaskIds.length ? `${row.currentTaskIds.length} ${row.currentTaskIds.length === 1 ? "task" : "tasks"}` : "Earlier work"}</summary><ul>{row.tasks.map(task => <li key={JSON.stringify([task.id, task.wording, task.sourceVersion, task.needsReview])}><p>{shortTaskLabel(task.wording, 120)}</p><p className="skills-overview__hint">{task.needsReview ? "Earlier work, needs review" : task.decision === "use" ? "You reported using this" : task.decision === "accepted" ? "You said this fits your work" : task.decision === "no" || task.decision === "rejected" ? "You said this does not fit" : task.decision === "unsure" ? "You were not sure" : "Suggested from wording, not confirmed"}{task.wantsLearning ? " · Learning interest" : ""}</p>{!task.needsReview && <Button variant="link" onClick={() => onReview(task.id)}>Review this task</Button>}</li>)}</ul><p className="skills-overview__source">{row.source === "esco" ? row.kind === "knowledge" ? "ESCO knowledge area" : "ESCO concept" : row.source === "wef" ? "WEF broad skill" : "Your own skill entry"}</p></details>
      {row.goalIds.length > 0 && <Link to={`${ROUTES.learningGoals}?goal=${encodeURIComponent(row.goalIds[0])}`}>Open saved goal</Link>}
    </li>)}</ul>}
    {visible.length > limit && <Button variant="link" className="skills-overview__more" onClick={() => setLimit(value => value + 6)}>Show more entries</Button>}
    <details className="skills-overview__coverage"><summary>Review coverage across {tasks.length} {tasks.length === 1 ? "task" : "tasks"}</summary><ul>{tasks.map(task => <li key={task.id}><div><strong>{shortTaskLabel(task.wording)}</strong><p>{overview.rows.filter(row => row.tasks.some(link => link.id === task.id && !link.needsReview)).length} skill entries connected{current?.skipped.includes(task.id) ? " · Review this longer task to choose a search focus" : current?.failed.includes(task.id) ? " · New suggestions unavailable" : ""}</p></div><Button variant="link" onClick={() => onReview(task.id)}>Review this task</Button></li>)}</ul></details>
  </section>;
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { cleanDisplayText, shortTaskLabel } from "@/lib/displayText";
import { readJourneyProfile, readJourneyState } from "@/features/journey/journey";
import { readSpecialistState, specialistEntryKey } from "@/features/journey/specialistSkills";
import { readLearningGoals } from "@/features/learning-goals/learningGoals";
import { pendingLearningInterests } from "@/pages/Skills/lib/pendingLearningInterests";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { specialistSkillService } from "@/services/specialistSkillService";

/** The generic learning page can recover an interest without asking the user to choose it again. */
export default function PendingLearningInterests() {
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState<{ owner: number; version: string } | null>(null);
  const [failure, setFailure] = useState<{ owner: number; attempt: number } | null>(null);
  const [retry, setRetry] = useState(0);
  const [shown, setShown] = useState(3);
  const owner = currentWorkspaceSession();
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("workspace-change", refresh);
    return () => window.removeEventListener("workspace-change", refresh);
  }, []);
  void revision;
  let data: ReturnType<typeof pendingLearningInterests> | null = null;
  let error = "";
  try {
    const profile = readJourneyProfile();
    data = pendingLearningInterests({
      tasks: profile.tasks, tasksConfirmed: Boolean(profile.tasksConfirmed), occupationCode: profile.tasksOccupationCode,
      specialist: readSpecialistState().entries, personal: readJourneyState().personalSkills ?? [],
      sourceVersion: source?.owner === owner ? source.version : null,
      goalSourceKeys: readLearningGoals().map(goal => goal.sourceKey),
    });
  } catch { error = "Your saved learning interests could not be read. Reload your saved work before continuing."; }
  const needsVersion = (data?.checking ?? 0) > 0;
  useEffect(() => {
    if (!needsVersion) return;
    const controller = new AbortController();
    void specialistSkillService.skills("", 0, controller.signal).then(result => {
      if (!controller.signal.aborted && owner === currentWorkspaceSession()) setSource({ owner, version: result.version });
    }).catch(() => {
      if (!controller.signal.aborted && owner === currentWorkspaceSession()) setFailure({ owner, attempt: retry });
    });
    return () => controller.abort();
  }, [needsVersion, owner, retry]);
  if (error) return <section className="lg-card"><p role="alert">{error}</p></section>;
  if (!data || (!data.specialist.length && !data.personal.length && !data.checking && !data.stale)) return null;
  const choices = [
    ...data.specialist.map(entry => ({ key: `specialist:${specialistEntryKey(entry)}`, label: entry.skillLabel, task: entry.taskWording, query: { specialist: specialistEntryKey(entry) } })),
    ...data.personal.map(entry => ({ key: `personal:${entry.id}`, label: entry.name, task: entry.taskLabels.join(". "), query: { personal: entry.id } })),
  ];
  return <section className="lg-card" aria-labelledby="pending-learning-title">
    <p className="lg-eyebrow">From your skill choices</p>
    <h2 id="pending-learning-title">Turn a saved interest into a goal</h2>
    <p>Your task and skill choice are ready. Choose one to review and save as a goal.</p>
    {choices.length > 0 && <ul className="lg-goal-list">{choices.slice(0, shown).map(choice => <li key={choice.key}><div><strong>{cleanDisplayText(choice.label)}</strong><p className="lg-muted">{shortTaskLabel(choice.task, 110)}</p></div><Link className="lg-primary" to={`${ROUTES.learningGoals}?${new URLSearchParams(choice.query)}`}>Continue with this skill</Link></li>)}</ul>}
    {choices.length > shown && <button onClick={() => setShown(value => value + 3)}>Show more interests</button>}
    {data.checking > 0 && (failure?.owner === owner && failure.attempt === retry ? <div><p role="alert">We could not check the catalogue version. Your interests are kept.</p><button onClick={() => setRetry(value => value + 1)}>Retry catalogue check</button></div> : <p role="status">Checking the source for your saved catalogue interests…</p>)}
    {data.stale > 0 && <details><summary>{data.stale} earlier {data.stale === 1 ? "interest needs" : "interests need"} review</summary><p>The task or source has changed. Review your skill choices before using them for a new goal.</p><Link to={ROUTES.skills}>Review my skills</Link></details>}
  </section>;
}

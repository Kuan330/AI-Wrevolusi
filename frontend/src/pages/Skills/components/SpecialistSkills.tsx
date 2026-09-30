import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cleanDisplayText, shortTaskLabel } from "@/lib/displayText";
import { ROUTES } from "@/constants/routes";
import type { ProfileTask } from "@/features/work-profile/types";
import {
  readSpecialistState, saveSpecialistEntry,
  specialistEntryIsCurrent, specialistEntryKey, type SpecialistEntry,
} from "@/features/journey/specialistSkills";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { specialistSkillService, type SpecialistCatalogue, type SpecialistSkill, type SpecialistOccupation } from "@/services/specialistSkillService";
import { suggestSpecialistSkills } from "../lib/specialistSuggestions";
import SpecialistSourceSearch from "./SpecialistSourceSearch";
import GuidedSkillSuggestions from "./GuidedSkillSuggestions";
import "./SpecialistSkills.css";

function readSaved() {
  try { return { data: readSpecialistState(), error: "" }; }
  catch { return { data: null, error: "Your saved specialist skills could not be read. Reload before making changes." }; }
}
export default function SpecialistSkills({ tasks, occupationCode, focusTaskId, onTaskChange }: {
  tasks: ProfileTask[]; occupationCode: string | null; focusTaskId?: string; onTaskChange?: (id: string) => void;
}) {
  const [taskId, setTaskId] = useState(focusTaskId || tasks[0]?.id || "");
  const [loadedRole, setRoleData] = useState<{ key: string; data: SpecialistCatalogue } | null>(null);
  const [chosenRole, setChosenRole] = useState<{ context: string; role: SpecialistOccupation } | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [sourceVersion, setSourceVersion] = useState<{ context: string; version: string } | null>(null);
  const [versionFailure, setVersionFailure] = useState<{ context: string; attempt: number; message: string } | null>(null);
  const [versionAttempt, setVersionAttempt] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(readSaved);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [query, setQuery] = useState("");
  const mounted = useRef(false);
  const busy = useRef(false);
  const roleContext = JSON.stringify([currentWorkspaceSession(), occupationCode]);
  const selectedRole = chosenRole?.context === roleContext ? chosenRole.role : null;
  const rememberSourceVersion = useCallback((version: string) => { setSourceVersion({ context: roleContext, version }); setVersionFailure(null); }, [roleContext]);
  const roleKey = JSON.stringify([roleContext, selectedRole?.uri]);
  const context = JSON.stringify([currentWorkspaceSession(), occupationCode, tasks.map(task => [task.id, task.wording])]);
  const currentContext = useRef(context);
  useLayoutEffect(() => { currentContext.current = context; }, [context]);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => { setSaved(readSaved()); setMessage(""); setSaveError(""); };
    window.addEventListener("workspace-change", refresh);
    return () => { mounted.current = false; window.removeEventListener("workspace-change", refresh); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void specialistSkillService.skills("", 0, controller.signal).then(data => {
      if (!controller.signal.aborted) rememberSourceVersion(data.version);
    }).catch(() => {
      if (!controller.signal.aborted) setVersionFailure({ context: roleContext, attempt: versionAttempt, message: "The catalogue is unavailable. Your saved choices are still here, but we cannot check the source version yet." });
    });
    return () => controller.abort();
  }, [roleContext, rememberSourceVersion, versionAttempt]);
  const firstTaskId = tasks[0]?.id || "";
  useEffect(() => { setTaskId(focusTaskId || firstTaskId); setQuery(""); }, [focusTaskId, firstTaskId, context]);
  useEffect(() => {
    const controller = new AbortController();
    setRoleError(""); setVisibleCount(3); setQuery("");
    if (!selectedRole) { setRoleLoading(false); return () => controller.abort(); }
    setRoleLoading(true);
    void specialistSkillService.forOccupation(selectedRole.uri, controller.signal).then(data => {
      if (!controller.signal.aborted) setRoleData({ key: roleKey, data });
    }).catch(() => { if (!controller.signal.aborted) setRoleError("The skills for this source occupation could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setRoleLoading(false); });
    return () => controller.abort();
  }, [selectedRole, roleKey, attempt]);
  const catalogue = selectedRole && loadedRole?.key === roleKey ? loadedRole.data : null;
  const versionError = versionFailure?.context === roleContext && versionFailure.attempt === versionAttempt ? versionFailure.message : "";
  const currentVersion = catalogue?.version || (sourceVersion?.context === roleContext ? sourceVersion.version : "");
  function chooseRole(role: SpecialistOccupation) { setChosenRole({ context: roleContext, role }); setQuery(""); setVisibleCount(3); }

  const task = tasks.find(item => item.id === taskId) || tasks[0];
  const entries = saved.data?.entries ?? [];
  const currentEntries = entries.filter(entry => specialistEntryIsCurrent(entry, tasks, occupationCode) && (!currentVersion || entry.sourceVersion === currentVersion));
  const interests = currentEntries.filter(entry => entry.wantsLearning);
  const suggestions = task ? suggestSpecialistSkills(task.wording, catalogue?.skills ?? []) : [];
  const top = suggestions.slice(0, 3);
  const remaining = (catalogue?.skills ?? []).filter(skill => !top.some(item => item.skill.uri === skill.uri));
  const filteredRemaining = remaining.filter(skill => [skill.label, ...skill.aliases].join(" ").toLowerCase().includes(query.toLowerCase()));
  const disabled = saving || Boolean(saved.error) || !currentVersion;

  async function runSave(action: () => Promise<void>, success: string) {
    if (busy.current || saved.error) return;
    const owner = currentWorkspaceSession();
    const startedContext = currentContext.current;
    busy.current = true; setSaving(true); setSaveError(""); setMessage("");
    try {
      await action();
      if (mounted.current && owner === currentWorkspaceSession() && startedContext === currentContext.current) {
        setSaved(readSaved()); setMessage(success);
      }
    } catch (error) {
      if (mounted.current && owner === currentWorkspaceSession() && startedContext === currentContext.current)
        setSaveError(error instanceof Error ? error.message : "Your change could not be saved. Try your choice again.");
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  function update(skill: SpecialistSkill, version: string, sourceOccupationUri: string | null, patch: Partial<Pick<SpecialistEntry, "decision" | "wantsLearning">>) {
    if (!task || !version) return;
    const existing = currentEntries.find(entry => entry.taskId === task.id && entry.skillUri === skill.uri);
    void runSave(() => saveSpecialistEntry({
      taskId: task.id, taskWording: task.wording, occupationCode, skillUri: skill.uri,
      skillLabel: skill.label, sourceVersion: version, sourceOccupationUri,
      decision: existing?.decision ?? null, wantsLearning: existing?.wantsLearning ?? false, ...patch,
    }), "Your skill choice is saved.");
  }
  function card(skill: SpecialistSkill, sharedWords: string[] = [], version = catalogue?.version ?? "", sourceOccupationUri: string | null = catalogue?.occupation_uri ?? null) {
    const entry = entries.find(item => specialistEntryIsCurrent(item, tasks, occupationCode) && item.sourceVersion === version && item.taskId === task?.id && item.skillUri === skill.uri);
    return <article key={skill.uri} className="specialist-skills__card">
      <h3>{cleanDisplayText(skill.label)}</h3>
      <p className="specialist-skills__reason">{skill.skill_type === "knowledge" ? "Knowledge area" : skill.skill_type === "unspecified" ? "Concept · source type not recorded" : "Skill / competence"}</p>
      <p className="specialist-skills__description">{skill.description ? shortTaskLabel(skill.description, 180) : "No description is available in this source record."}</p>
      {skill.match_type === "related" && <p className="specialist-skills__reason">Related wording only. This may not fit your task.</p>}
      <p className="specialist-skills__reason">{sharedWords.length ? `Shared words with your task: ${sharedWords.join(", ")}. Check whether this connection fits.` : sourceOccupationUri ? "Listed for the source occupation. Check whether it fits this task." : "You found this in the ESCO catalogue. No occupation or task relationship has been assumed."}</p>
      <details><summary>Meaning and source</summary>
        <p>{cleanDisplayText(skill.description || "No description is available in this source record.")}</p>
        <p>ESCO {version} · {skill.skill_type}{sourceOccupationUri ? ` · ${skill.source_relations && skill.source_relations.length > 1 ? `source records mark ${skill.source_relations.join(" and ")}` : skill.relation} for ${catalogue?.occupation_label}` : " · Independent source concept"}.</p>
        <p>{sourceOccupationUri ? "This is an occupation-level source relationship, not proof that your task uses this skill or that you have mastered it." : "There is no occupation relationship attached to this choice. Your decision will link it to your task as your own statement."}</p>
        {entry && entry.sourceOccupationUri !== undefined && entry.sourceOccupationUri !== sourceOccupationUri && <p>Your earlier decision used a different source reference. The skill concept is the same; making a new choice will update its reference.</p>}
        <a href={skill.uri} target="_blank" rel="noreferrer">Open ESCO concept</a>
      </details>
      <p className="specialist-skills__experience-label">Does this fit your work?</p>
      <div className="specialist-skills__choices" aria-label={`Review ${skill.label}`}>
        {([['use', 'I use this'], ['no', 'Does not fit'], ['unsure', 'Not sure']] as const).map(([value, label]) =>
          <Button key={value} variant={entry?.decision === value ? "default" : "outline"} aria-pressed={entry?.decision === value} disabled={disabled} onClick={() => update(skill, version, sourceOccupationUri, { decision: entry?.decision === value ? null : value })}>{label}</Button>)}
      </div>
      <label className="specialist-skills__learn"><input type="checkbox" checked={entry?.wantsLearning ?? false} disabled={disabled} onChange={event => update(skill, version, sourceOccupationUri, { wantsLearning: event.target.checked })} /> I want to develop this</label>
      {entry?.wantsLearning && <Button asChild><Link to={`${ROUTES.learningGoals}?${new URLSearchParams({ specialist: specialistEntryKey(entry) })}`} aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}>Continue with this skill</Link></Button>}
    </article>;
  }
  if (!tasks.length) return null;
  return <section className="specialist-skills" aria-labelledby="specialist-title">
    <header><p className="specialist-skills__eyebrow">Specific skills from your work</p><h2 id="specialist-title">Start with one task</h2><p>Find a skill, check its meaning, then choose a learning step.</p></header>
    <label htmlFor="specialist-task">Which task would you like to review?</label>
    <select id="specialist-task" value={task?.id ?? ""} disabled={saving} onChange={event => { setTaskId(event.target.value); onTaskChange?.(event.target.value); setQuery(""); }}>
      {tasks.map(item => <option key={item.id} value={item.id}>{shortTaskLabel(item.wording)}</option>)}
    </select>

    {saved.error && <p role="alert">{saved.error}</p>}
    {saveError && <p role="alert">{saveError} Your change is not confirmed saved. Try your choice again.</p>}
    <p role="status" aria-live="polite">{saving ? "Saving your choice…" : message}</p>
    {entries.length > 0 && <div className="specialist-skills__next"><h3>Saved learning interests</h3>
      {!currentVersion && (versionError ? <div role="alert"><p>{versionError}</p><Button variant="outline" onClick={() => setVersionAttempt(value => value + 1)}>Retry catalogue check</Button></div> : <p role="status">Checking the catalogue version for your saved choices…</p>)}
      {interests.length > 0 && <ul className="specialist-skills__saved-list">{interests.map(entry => <li key={specialistEntryKey(entry)}><strong>{cleanDisplayText(entry.skillLabel)}</strong><p className="specialist-skills__reason">From your task: {shortTaskLabel(entry.taskWording)}</p><Button asChild variant="outline"><Link to={`${ROUTES.learningGoals}?${new URLSearchParams({ specialist: specialistEntryKey(entry) })}`} aria-disabled={disabled} onClick={event => { if (disabled) event.preventDefault(); }}>Continue with this skill</Link></Button></li>)}</ul>}
      {entries.length > currentEntries.length && <p className="specialist-skills__reason">{entries.length - currentEntries.length} earlier choices need review after your work or the source version changed. Review the current task to save a fresh choice.</p>}
      {currentEntries.length > 0 && <details><summary>My saved skill choices ({currentEntries.length})</summary><ul className="specialist-skills__saved-list">{currentEntries.map(entry => <li key={specialistEntryKey(entry)}><strong>{cleanDisplayText(entry.skillLabel)}</strong><p>{entry.decision === "use" ? "I use this" : entry.decision === "no" ? "Does not fit" : entry.decision === "unsure" ? "Not sure" : "Not reviewed"}{entry.wantsLearning ? " · I want to develop this" : ""}</p><p className="specialist-skills__reason">{shortTaskLabel(entry.taskWording)} · ESCO {entry.sourceVersion}</p></li>)}</ul></details>}
      <p className="specialist-skills__reason">Learning builds your capability. It does not lower the research exposure score.</p>
    </div>}
    {task && <GuidedSkillSuggestions key={JSON.stringify([currentWorkspaceSession(), task.id, task.wording, occupationCode])} task={task} occupationCode={occupationCode} disabled={saving || Boolean(saved.error)} onBusyChange={setSaving} onVersion={rememberSourceVersion} />}
    <details className="specialist-skills__browse"><summary>Search the catalogue myself <span className="specialist-skills__reason">Optional</span></summary>
    <div className="specialist-skills__primary-search">
      <h3>Find skills that fit this task</h3>
      <p className="specialist-skills__reason">Search the full ESCO catalogue. Read each meaning and decide whether you use it or want to learn it.</p>
      <SpecialistSourceSearch key={`skills-${roleContext}-${task?.id}`} kind="skill" taskWording={task?.wording} disabled={saving} onVersion={rememberSourceVersion} renderSkill={(skill, version) => card(skill, [], version, null)} />
      <a href="#add-personal-skill" onClick={() => { const details = document.getElementById("add-personal-skill"); if (details instanceof HTMLDetailsElement) details.open = true; requestAnimationFrame(() => document.getElementById("personal-skill-name")?.focus()); }}>Cannot find your skill? Add it in your own words</a>
    </div>
    </details>
    <details className="specialist-skills__browse"><summary>Browse by occupation instead <span className="specialist-skills__reason">Optional</span></summary>
    <div className="specialist-skills__references">
      <h3>Search a source occupation</h3>
      <p className="specialist-skills__reason">Search for a source occupation by name. Malaysian occupation codes are not used to choose an ESCO role. Your choice helps you find skills; it does not change your work profile or confirm a Malaysian job match.</p>
      <SpecialistSourceSearch key={`roles-${roleContext}`} kind="occupation" disabled={saving} onChoose={chooseRole} onVersion={rememberSourceVersion} />
      {selectedRole && <p>Exploring: <strong>{selectedRole.label}</strong> · ESCO source ISCO code {selectedRole.isco_code}</p>}
    </div>
    {roleLoading ? <p role="status">Loading skills for this source occupation…</p> : roleError ? <div role="alert"><p>{roleError}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry loading skills</Button></div> : catalogue ? <>
      <p className="specialist-skills__reason">{catalogue.skills.length} source concepts for {catalogue.occupation_label} · ESCO {catalogue.version}. These include skills and knowledge.</p>
      {top.length ? <div className="specialist-skills__cards">{top.map(item => card(item.skill, item.sharedWords))}</div> : <p>No clear wording match for this task. Browse the source occupation list or search all skills below.</p>}
      {remaining.length > 0 && <details className="specialist-skills__browse"><summary>Browse occupation skills ({remaining.length})</summary>
        <label htmlFor="specialist-search">Find a skill or knowledge area in this occupation</label>
        <input id="specialist-search" value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(3); }} type="search" />
        <p className="specialist-skills__reason">Showing {Math.min(visibleCount, filteredRemaining.length)} of {filteredRemaining.length}</p>
        <div className="specialist-skills__cards">{filteredRemaining.slice(0, visibleCount).map(skill => card(skill))}</div>
        {filteredRemaining.length > visibleCount && <Button variant="outline" onClick={() => setVisibleCount(value => value + 3)}>Show 3 more</Button>}
      </details>}
      <details><summary>How these suggestions were found</summary><p>{cleanDisplayText(catalogue.mapping_note)}</p>{catalogue.attribution && <p>{cleanDisplayText(catalogue.attribution)}</p>}{catalogue.license_url && <a href={catalogue.license_url} target="_blank" rel="noreferrer">{catalogue.license || "Source reuse terms"}</a>}<p>Shared words in your task and the source names help order the first suggestions. We have not validated these task-to-skill links for your workplace. Your review records your own statement, not a qualification.</p></details>
    </> : null}
    </details>
    {entries.length > currentEntries.length && <details><summary>Earlier saved choices ({entries.length - currentEntries.length})</summary>
      <p>These choices are kept, but their work context or a checked source version has changed. Review a current suggestion to update the choice.</p>
      <ul>{entries.filter(entry => !currentEntries.includes(entry)).map(entry => <li key={specialistEntryKey(entry)}><strong>{cleanDisplayText(entry.skillLabel)}</strong> — {shortTaskLabel(entry.taskWording)} · ESCO {entry.sourceVersion} · {entry.decision === "use" ? "You said you use this" : entry.decision === "no" ? "Did not fit" : entry.decision === "unsure" ? "Not sure" : "Not reviewed"}{entry.wantsLearning ? " · Learning interest" : ""}</li>)}</ul>
    </details>}

  </section>;
}

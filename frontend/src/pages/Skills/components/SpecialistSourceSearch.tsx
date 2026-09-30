import { useEffect, useState, type ReactNode } from "react";
import { cleanDisplayText } from "@/lib/displayText";
import { Button } from "@/components/ui/button";
import { prepareTaskSkillQuery, SKILL_QUERY_LIMIT } from "../lib/taskSkillQuery";
import { specialistSkillService, type SpecialistOccupation, type SpecialistSkill } from "@/services/specialistSkillService";

type SearchProps = { disabled: boolean; onVersion?: (version: string) => void } & (
  { kind: "occupation"; onChoose: (occupation: SpecialistOccupation) => void } |
  { kind: "skill"; taskWording?: string; renderSkill: (skill: SpecialistSkill, version: string) => ReactNode }
);
/** Paged source browsing. A result is never a validated match to the user's work. */
export default function SpecialistSourceSearch(props: SearchProps) {
  const [query, setQuery] = useState("");
  const [taskSearch, setTaskSearch] = useState<ReturnType<typeof prepareTaskSkillQuery> | null>(null);
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [disclosure, setDisclosure] = useState<{ key: string; count: number } | null>(null);
  const [result, setResult] = useState<{ key: string; version: string; total: number; items: (SpecialistSkill | SpecialistOccupation)[]; attribution?: string; license?: string; license_url?: string; search_mode?: string } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const { kind, onVersion } = props;
  const currentTaskSearch = props.kind === "skill" && taskSearch?.fullTask === props.taskWording ? taskSearch : null;
  const cleanQuery = query.trim();
  const minimumLength = kind === "skill" ? 1 : 2;
  const key = JSON.stringify([kind, cleanQuery, offset, attempt]);
  useEffect(() => {
    if (cleanQuery.length < minimumLength) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const request = kind === "occupation" ? specialistSkillService.occupations(cleanQuery, offset, controller.signal) : specialistSkillService.skills(cleanQuery, offset, controller.signal);
      void request.then(data => {
        if (!controller.signal.aborted) { setResult({ key, version: data.version, total: data.total, items: data.items, attribution: data.attribution, license: data.license, license_url: data.license_url, search_mode: data.search_mode }); onVersion?.(data.version); }
      }).catch(() => {
        if (!controller.signal.aborted) setFailure({ key, message: "The ESCO search could not be loaded. Please try again." });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [cleanQuery, offset, kind, key, onVersion, minimumLength]);
  const current = result?.key === key ? result : null;
  const error = failure?.key === key ? failure.message : "";
  const visibleCount = disclosure?.key === key ? disclosure.count : 3;
  const visibleItems = current?.items.slice(0, visibleCount) ?? [];
  const id = `specialist-${props.kind}-search`;
  return <div className="specialist-skills__source-search">
    <label htmlFor={id}>{props.kind === "occupation" ? "Search all ESCO occupations" : "Search for a skill or describe your task"}</label>
    <input id={id} type="search" maxLength={kind === "skill" ? SKILL_QUERY_LIMIT : 120} value={query} disabled={props.disabled} placeholder={props.kind === "occupation" ? "For example, mechanical or nursing" : "For example, prepare monthly sales reports or Excel"} onChange={event => { setQuery(event.target.value); setOffset(0); }} />
    {props.kind === "skill" && props.taskWording && <Button className="specialist-skills__task-search" variant="outline" disabled={props.disabled} onClick={() => {
      const prepared = prepareTaskSkillQuery(props.taskWording!);
      setTaskSearch(prepared); setQuery(prepared.query); setOffset(0); setAttempt(value => value + 1);
      if (prepared.requiresFocus) requestAnimationFrame(() => document.getElementById(id)?.focus());
    }}>Find suggested skills for this task</Button>}
    {currentTaskSearch && <div className="specialist-skills__task-context">
      {currentTaskSearch.requiresFocus && <p className="specialist-skills__reason">This task has more detail than one search. Choose one activity or key phrase in the search field. Your full task remains saved.</p>}
      <details open={currentTaskSearch.requiresFocus}><summary>Your full confirmed task</summary><p className="specialist-skills__full-task">{currentTaskSearch.fullTask}</p></details>
      <p className="specialist-skills__reason">You can search any part of this task. A search result is a candidate to review, not a confirmed task match.</p>
    </div>}
    {cleanQuery.length < minimumLength ? <p className="specialist-skills__reason">Use a task, skill or tool name. Results are ideas to review, not skills assigned to you.</p> : error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry search</Button></div> : !current ? <p role="status">Searching ESCO…</p> : <>
      {props.kind === "skill" && <p className="specialist-skills__reason"><strong>Search wording:</strong> {cleanQuery}</p>}
      <p role="status">{current.total === 0 ? "No source records found. Try a shorter task phrase or a different skill or tool name." : `Showing ${offset + 1}–${offset + visibleItems.length} of ${current.total} source records · ESCO ${current.version}`}</p>
      {props.kind === "skill" && current.total === 0 && <a href="#add-personal-skill" onClick={() => { const details = document.getElementById("add-personal-skill"); if (details instanceof HTMLDetailsElement) details.open = true; requestAnimationFrame(() => document.getElementById("personal-skill-name")?.focus()); }}>Add a skill in your own words</a>}
      {props.kind === "skill" && current.search_mode === "related" && <p className="specialist-skills__reason">These results match part of your wording. Check their meaning before choosing one.</p>}
      {props.kind === "occupation" ? <ul className="specialist-skills__role-results">{(visibleItems as SpecialistOccupation[]).map(role => <li key={role.uri}><Button variant="outline" disabled={props.disabled} onClick={() => props.onChoose(role)}>{cleanDisplayText(role.label)}</Button><span>ISCO {role.isco_code}</span></li>)}</ul> : <div className="specialist-skills__cards">{(visibleItems as SpecialistSkill[]).map(skill => props.renderSkill(skill, current.version))}</div>}
      {current.items.length > visibleCount && <Button variant="outline" disabled={props.disabled} onClick={() => setDisclosure({ key, count: visibleCount + 3 })}>Show more results</Button>}
      <details><summary>Source and reuse terms</summary><p>{current.attribution || "ESCO · European Commission"}</p>{current.license_url && <a href={current.license_url} target="_blank" rel="noreferrer">{current.license || "Source reuse terms"}</a>}<p>ESCO {current.version}. These are source records, not verified task matches.</p></details>
      <div className="specialist-skills__choices">{offset > 0 && <Button variant="outline" disabled={props.disabled} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous results</Button>}{visibleCount >= current.items.length && offset + current.items.length < current.total && <Button variant="outline" disabled={props.disabled} onClick={() => setOffset(value => value + 20)}>Next results</Button>}</div>
    </>}
  </div>;
}

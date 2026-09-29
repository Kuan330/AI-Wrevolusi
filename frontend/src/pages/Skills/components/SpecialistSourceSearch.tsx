import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { specialistSkillService, type SpecialistOccupation, type SpecialistSkill } from "@/services/specialistSkillService";

type SearchProps = { disabled: boolean; onVersion?: (version: string) => void } & (
  { kind: "occupation"; onChoose: (occupation: SpecialistOccupation) => void } |
  { kind: "skill"; renderSkill: (skill: SpecialistSkill, version: string) => ReactNode }
);
/** Paged source browsing. A result is never a validated match to the user's work. */
export default function SpecialistSourceSearch(props: SearchProps) {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; version: string; total: number; items: (SpecialistSkill | SpecialistOccupation)[]; attribution?: string; license?: string; license_url?: string } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const { kind, onVersion } = props;
  const cleanQuery = query.trim();
  const key = JSON.stringify([kind, cleanQuery, offset, attempt]);
  useEffect(() => {
    if (cleanQuery.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const request = kind === "occupation" ? specialistSkillService.occupations(cleanQuery, offset, controller.signal) : specialistSkillService.skills(cleanQuery, offset, controller.signal);
      void request.then(data => {
        if (!controller.signal.aborted) { setResult({ key, version: data.version, total: data.total, items: data.items, attribution: data.attribution, license: data.license, license_url: data.license_url }); onVersion?.(data.version); }
      }).catch(() => {
        if (!controller.signal.aborted) setFailure({ key, message: "The ESCO search could not be loaded. Please try again." });
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [cleanQuery, offset, kind, key, onVersion]);
  const current = result?.key === key ? result : null;
  const error = failure?.key === key ? failure.message : "";
  const id = `specialist-${props.kind}-search`;
  return <div className="specialist-skills__source-search">
    <label htmlFor={id}>{props.kind === "occupation" ? "Search all ESCO occupations" : "Search all ESCO skills and knowledge"}</label>
    <input id={id} type="search" value={query} disabled={props.disabled} placeholder={props.kind === "occupation" ? "For example, mechanical or nursing" : "For example, welding or budgeting"} onChange={event => { setQuery(event.target.value); setOffset(0); }} />
    {cleanQuery.length < 2 ? <p className="specialist-skills__reason">Enter at least two letters. Search uses the source's English names and aliases.</p> : error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry search</Button></div> : !current ? <p role="status">Searching ESCO…</p> : <>
      <p role="status">{current.total === 0 ? "No source records found. Try another word or add your own skill below." : `Showing ${offset + 1}–${offset + current.items.length} of ${current.total} source records · ESCO ${current.version}`}</p>
      {props.kind === "occupation" ? <ul className="specialist-skills__role-results">{(current.items as SpecialistOccupation[]).map(role => <li key={role.uri}><Button variant="outline" disabled={props.disabled} onClick={() => props.onChoose(role)}>{role.label}</Button><span>ISCO {role.isco_code}</span></li>)}</ul> : <div className="specialist-skills__cards">{(current.items as SpecialistSkill[]).map(skill => props.renderSkill(skill, current.version))}</div>}
      <details><summary>Source and reuse terms</summary><p>{current.attribution || "ESCO · European Commission"}</p>{current.license_url && <a href={current.license_url} target="_blank" rel="noreferrer">{current.license || "Source reuse terms"}</a>}<p>ESCO {current.version}. These are source records, not verified task matches.</p></details>
      <div className="specialist-skills__choices">{offset > 0 && <Button variant="outline" disabled={props.disabled} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous results</Button>}{offset + current.items.length < current.total && <Button variant="outline" disabled={props.disabled} onClick={() => setOffset(value => value + 20)}>Next results</Button>}</div>
    </>}
  </div>;
}

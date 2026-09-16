import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, X, Check } from "lucide-react";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import { loadPossibilitiesData, type PossibilitiesData, skillGroup, directionMatch, type SkillGroup } from "./possibilitiesData";
import PageHeader from "@/components/common/PageHeader";
import BotPet from "@/components/common/BotPet";
import { useBotPetGreeting } from "@/hooks/useBotPetGreeting";
import "./exploration.css";

const KEY = "aiwrevolusi.possibilities.courseExploration.v1";
type Choice = { direction: string; themes: string[] };
function readChoice(): Choice {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (v && typeof v.direction === "string" && Array.isArray(v.themes) && v.themes.every((id: unknown) => typeof id === "string")) return v;
  } catch { /* An unreadable choice must not prevent browsing. */ }
  return { direction: "", themes: [] };
}
export default function Possibilities() {
  const [data, setData] = useState<PossibilitiesData | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<Choice>(readChoice);
  const detailRef = useRef<HTMLElement>(null);
  const choicesRef = useRef<HTMLElement>(null);
  const planbarRef = useRef<HTMLDivElement>(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const { speech: petSpeech, say: sayPet } = useBotPetGreeting("possibilities");
  useEffect(() => {
    if (selectionVersion > 0) {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    }
  }, [selectionVersion]);
  const [analysis] = useState(readConfirmedAnalysis);
  useEffect(() => { let active = true; loadPossibilitiesData().then(v => { if (active) setData(v); }).catch(() => { if (active) setError("Could not load career exploration. Please reload and try again."); }); return () => { active = false; }; }, []);
  // Preview choices stay in this browser tab; they never enter the real plan.
  function update(next: Choice) {
    setChoice(next);
    try { sessionStorage.setItem(KEY, JSON.stringify(next)); }
    catch { setError("Your choices work on this page but could not be kept for this browser session."); }
  }
  function toggle(id: string) {
    const removing = choice.themes.includes(id);
    update({
      ...choice,
      themes: removing
        ? choice.themes.filter((x) => x !== id)
        : [...choice.themes, id],
    });
    if (removing) sayPet("remove-item");
    else sayPet("add-skill-chip");
  }
  if (!data) return <div className="px-page"><p role={error ? "alert" : "status"}>{error || "Loading possibilities…"}</p></div>;
  const coverage = Math.round(data.currentRoleThemeIds.filter(id => data.currentThemeIds.includes(id)).length / Math.max(1, data.currentRoleThemeIds.length) * 100);
  const groups: { id: SkillGroup; label: string }[] = [{ id: "have", label: "Already have" }, { id: "learning", label: "Currently learning" }, { id: "planned", label: "Added to plan" }, { id: "missing", label: "Add to plan — tap to queue" }];
  const selected = data.directions.find(d => d.id === choice.direction);
  const name = (id: string) => data.themes.find(t => t.id === id)?.name ?? id;
  const strengths = data.currentRoleThemeIds.filter(id => data.currentThemeIds.includes(id));
  const gaps = data.currentRoleThemeIds.filter(id => !data.currentThemeIds.includes(id));
  const match = selected ? directionMatch(data, selected.themeIds, choice.themes) : 0;
  function choose(id: string) {
    update({ ...choice, direction: id });
    setSelectionVersion(version => version + 1);
  }
  function changeDirection() {
    choicesRef.current?.focus({ preventScroll: true });
    choicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function ring(value: number) {
    return <div className="px-ring" style={{ "--progress": `${value * 3.6}deg` } as CSSProperties}><strong>{value}<small>%</small></strong></div>;
  }
  return <div className="px-page">
    <PageHeader title="Possibilities" description="Grow in your current role, or explore where your experience could take you next." />
    <div className="px-banner"><span>{data.source === "demo" ? "EXPLORATION PREVIEW" : "CAREER EXPLORATION"}</span><p>{data.source === "demo" ? "Skills and match scores are examples. Direction scores include learning and planned skills; they are not a job-readiness assessment." : "Explore directions through your learning interests."}</p></div>
    {error && <p className="px-disclaimer" role="alert">{error}</p>}

    <section className="px-current" aria-labelledby="current-role-heading">
      <div className="px-current-intro"><p className="px-eyebrow">01 · YOUR STARTING POINT</p><h2 id="current-role-heading">{analysis?.occupationTitle || "Your current role"}</h2><p>{analysis ? "Your confirmed work profile is your starting point." : "Add your work profile to personalise your starting point."}</p><Link to="/profile">Review work profile <ArrowRight size={14} /></Link></div>
      <div className="px-current-score">{ring(coverage)}<strong>Current role coverage</strong><p>{data.source === "demo" ? "Example skill coverage" : "Related skills in your profile"}</p></div>
      <div className="px-current-skills"><h3>Build on your strengths</h3><div className="px-chips">{strengths.map(id => <span className="px-chip have" key={id}>{name(id)}</span>)}</div><h3>Keep growing in this role</h3><div className="px-chips">{gaps.map(id => { const added = choice.themes.includes(id); return <button className={`px-chip ${added ? "planned" : "missing"}`} key={id} onClick={() => toggle(id)} aria-pressed={added} aria-label={`${added ? "Remove" : "Add"} ${name(id)} ${added ? "from" : "to"} learning shortlist`}>{name(id)}{added ? <Check size={14} /> : <Plus size={14} />}<span>{added ? "Added to shortlist" : "Add to shortlist"}</span></button>; })}</div>{!gaps.length && <p>Your profile covers the skills listed for this role.</p>}<Link to="/learning-centre">Explore learning resources <ArrowRight size={14} /></Link></div>
    </section>

    <section className="px-options" ref={choicesRef} tabIndex={-1} aria-labelledby="directions-heading">
      <p className="px-eyebrow">02 · EXPLORE OTHER DIRECTIONS</p><h2 id="directions-heading">Where could you go next?</h2><p className="px-section-description">Compare the connections to your experience. Choose a direction to explore it in more detail.</p>
      <div className="px-direction-grid">{data.directions.map((role, ri) => {
        const chosen = selected?.id === role.id;
        const score = directionMatch(data, role.themeIds, choice.themes);
        return <article className={`px-direction-card px-accent-${ri} ${chosen ? "is-chosen" : ""}`} key={role.id}>
          <p className="px-eyebrow">{role.area}</p><h3>{role.title}</h3><div className="px-card-score"><strong>{score}<small>%</small></strong><span>EXAMPLE MATCH</span>{chosen && <span className="px-selected"><Check size={14} /> Chosen direction</span>}</div><p className="px-direction-description">{role.description}</p>
          <button className={chosen ? "px-primary" : "px-outline"} aria-pressed={chosen} aria-controls="chosen-direction" onClick={() => choose(role.id)}>{chosen ? "View chosen direction" : "Explore this direction"}<ArrowRight size={15} /></button>
        </article>;
      })}</div>
    </section>

    <section id="chosen-direction" ref={detailRef} tabIndex={-1} className="px-journey" aria-labelledby="journey-heading">
      {selected ? <>
        <div className="px-journey-top"><div><p className="px-eyebrow">03 · MY CHOSEN DIRECTION</p><h2 id="journey-heading">Your path to {selected.title}</h2></div><button className="px-outline" onClick={changeDirection}>Compare other directions</button></div>
        <div className="px-transition"><div><span>YOUR STARTING POINT</span><strong>{analysis?.occupationTitle || "Your current role"}</strong></div><ArrowRight aria-hidden="true" /><div><span>YOUR POSSIBLE NEXT DIRECTION</span><strong>{selected.title}</strong></div></div>
        <div className="px-journey-body"><div className="px-match-summary">{ring(match)}<small>EXAMPLE MATCH</small>{groups.map(g => <div className={`px-legend ${g.id}`} key={g.id}><span>{g.id === "have" ? "Have" : g.id === "learning" ? "Learning" : g.id === "planned" ? "Shortlisted" : "To explore"}</span><b>{selected.themeIds.filter(id => skillGroup(data, id, choice.themes) === g.id).length}</b></div>)}</div>
          <div className="px-skill-groups">{groups.map(g => {
            const ids = selected.themeIds.filter(id => skillGroup(data, id, choice.themes) === g.id);
            if (!ids.length) return null;
            return <section key={g.id}><h3>{g.id === "have" ? "Strengths you can bring with you" : g.id === "learning" ? "Skills you are developing" : g.id === "planned" ? "On your learning shortlist" : "Skills to explore next"}</h3><div className="px-chips">{ids.map(id => g.id === "missing" || g.id === "planned" ? <button className={`px-chip ${g.id}`} key={id} onClick={() => toggle(id)} aria-label={`${g.id === "planned" ? "Remove" : "Add"} ${name(id)} ${g.id === "planned" ? "from" : "to"} shortlist`}>{name(id)}{g.id === "planned" ? <X size={13} /> : <Plus size={13} />}</button> : <span className={`px-chip ${g.id}`} key={id}>{name(id)}</span>)}</div></section>;
          })}</div>
          <div className="px-direction-about"><p className="px-eyebrow">ABOUT THIS DIRECTION</p><h3>What could this involve?</h3><p>{selected.description}</p><p>Use the skills alongside this overview to decide what you would like to explore next.</p></div>
        </div>
        <div className="px-next-step"><div><h3>Take your next step</h3><p>Explore courses in Learning Resources and choose what to add to My Plan.</p></div><Link className="px-primary" to="/learning-centre">Explore learning resources <ArrowRight size={16} /></Link></div>
      </> : <div className="px-no-direction"><p className="px-eyebrow">03 · YOUR NEXT STEP</p><h2 id="journey-heading">Which direction would you like to explore?</h2><p>Choose a card above to see the strengths you can bring and the skills you could develop.</p></div>}
    </section>
    {choice.themes.length > 0 && <div className="px-planbar" ref={planbarRef} aria-label="Learning shortlist"><div><small>YOUR LEARNING LIST · THIS VISIT</small><div>{choice.themes.map(id => <button key={id} onClick={() => toggle(id)} aria-label={`Remove ${name(id)}`}>{name(id)}<X size={13} /></button>)}</div></div><Link to="/learning-centre">Browse learning resources <ArrowRight size={16} /></Link><p>Select courses in Learning Resources to add them to My Plan.</p></div>}
    <BotPet
      avoidRef={planbarRef}
      avoidActive={choice.themes.length > 0}
      speech={petSpeech}
    />
  </div>;
}

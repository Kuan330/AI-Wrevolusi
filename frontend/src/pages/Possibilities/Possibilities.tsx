import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import BotPet from "@/components/common/BotPet";
import { useBotPetGreeting } from "@/hooks/useBotPetGreeting";
import { possibilitiesService } from "@/services/possibilitiesService";
import { accountStorage } from "@/services/accountStorage";
import { toPossibilitiesData, type PossibilitiesData } from "./possibilitiesModel";
import "./exploration.css";

const DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
const SHORTLIST_KEY = "aiwrevolusi.possibilities.shortlist";
const readJson = <T,>(key: string, fallback: T): T => { try { const value = accountStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
export default function Possibilities() {
  const navigate = useNavigate();
  const [data, setData] = useState<PossibilitiesData | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(() => readJson<{ occupation_code?: string } | null>(DIRECTION_KEY, null)?.occupation_code ?? null);
  const [shortlist, setShortlist] = useState<number[]>(() => readJson<number[]>(SHORTLIST_KEY, []));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pageReady =
    !loading &&
    !error &&
    data !== null &&
    data.status !== "needs_profile" &&
    data.status !== "unavailable";
  const {
    speech: petSpeech,
    say: sayPet,
    dismiss: dismissPet,
    nudge: nudgePet,
  } = useBotPetGreeting("possibilities", { ready: pageReady });
  useEffect(() => { const controller = new AbortController(); void possibilitiesService.getPossibilities(controller.signal).then(r => { setData(toPossibilitiesData(r)); setLoading(false); setSelectedCode(current => { const candidate = current ?? r.chosen_direction_code; return r.directions.some(direction => direction.occupation_code === candidate) ? candidate : null; }); setShortlist(r.shortlisted_skill_ids.filter(id => r.skills.some(skill => skill.skill_id === id)).slice(0, 60)); }).catch(e => { if (e?.name !== "AbortError") { setError("Could not load career exploration. Please try again."); setLoading(false); } }); return () => controller.abort(); }, []);
  const saveShortlist = (ids: number[]) => { setShortlist(ids); accountStorage.setItem(SHORTLIST_KEY, JSON.stringify(ids)); };
  const choose = (code: string) => { setSelectedCode(code); const direction = data?.directions.find(item => item.occupation_code === code); if (direction) accountStorage.setItem(DIRECTION_KEY, JSON.stringify({ occupation_code: code, title: direction.title })); };
  const toggle = (id: number) => {
    const added = shortlist.includes(id);
    saveShortlist(added ? shortlist.filter(value => value !== id) : [...shortlist, id]);
    if (!added) sayPet("add-skill-chip");
  };
  if (loading) return <div className="px-page"><p role="status">Loading possibilities…</p></div>;
  if (error || !data) return <div className="px-page"><p role="alert">{error || "Possibilities are unavailable."}</p><Link to="/profile">Review your work profile</Link></div>;
  if (data.status === "needs_profile") return <div className="px-page"><PageHeader title="Possibilities" description="Explore directions based on your work profile." /><section className="px-no-direction"><h2>Complete your Work Profile</h2><p>Confirm your current role and tasks first so we can show relevant directions.</p><Link className="px-primary" to="/profile">Go to Work Profile <ArrowRight size={15} /></Link></section></div>;
  if (data.status === "unavailable") return <div className="px-page"><p role="alert">Possibilities are temporarily unavailable. Please try again later.</p></div>;
  const selected = data.directions.find(item => item.occupation_code === selectedCode);
  const skillName = (id: number) => data.skills.find(skill => skill.skill_id === id)?.name ?? String(id);
  return <div className="px-page"><PageHeader title="Possibilities" description="Grow in your current role, or explore where your experience could take you next." /><div className="px-banner"><span>CAREER EXPLORATION</span><p>{data.disclaimer}</p></div><section className="px-current"><div className="px-current-intro"><p className="px-eyebrow">01 · YOUR STARTING POINT</p><h2>{data.currentRole?.title ?? "Your current role"}</h2><p>These connections come from your confirmed Work Profile.</p><Link to="/profile">Review work profile <ArrowRight size={14} /></Link></div><div className="px-current-score"><strong>{data.currentRoleCoverage ?? 0}<small>%</small></strong><strong>Current role coverage</strong></div><div className="px-current-skills"><h3>Skills in your profile</h3><div className="px-chips">{data.skills.filter(s => s.state === "have").map(s => <span className="px-chip have" key={s.skill_id}>{s.name}</span>)}</div></div></section><section className="px-options"><p className="px-eyebrow">02 · EXPLORE OTHER DIRECTIONS</p><h2>Where could you go next?</h2><div className="px-direction-grid">{data.directions.slice(0, 3).map((direction, index) => <article className={`px-direction-card px-accent-${index} ${selected?.occupation_code === direction.occupation_code ? "is-chosen" : ""}`} key={direction.occupation_code}><p className="px-eyebrow">{direction.area}</p><h3>{direction.title}</h3><div className="px-card-score"><strong>{selected?.occupation_code === data.chosenDirectionCode && data.chosenDirectionCoverage !== null ? data.chosenDirectionCoverage : direction.coverage_pct ?? 0}<small>%</small></strong><span>SKILL COVERAGE</span></div><p>{direction.description}</p><button className={selected?.occupation_code === direction.occupation_code ? "px-primary" : "px-outline"} onClick={() => choose(direction.occupation_code)}>{selected?.occupation_code === direction.occupation_code ? "Chosen direction" : "Explore this direction"}<ArrowRight size={15} /></button></article>)}</div></section>{selected && <section className="px-journey"><p className="px-eyebrow">03 · MY CHOSEN DIRECTION</p><h2>Your path to {selected.title}</h2><p>{selected.description}</p><h3>Skills to explore next</h3><div className="px-chips">{selected.skills.map(skill => { const added = shortlist.includes(skill.skill_id); return <button className={`px-chip ${added ? "planned" : skill.state}`} key={skill.skill_id} onClick={() => toggle(skill.skill_id)}>{skillName(skill.skill_id)}{added ? <X size={13} /> : skill.state === "missing" ? <Plus size={13} /> : <Check size={13} />}</button>; })}</div><div className="px-next-step"><p>Browse verified courses for these skills in Learning Resources.</p><button className="px-primary" onClick={() => navigate(`/learning-centre?q=${encodeURIComponent(selected.title)}`)}>Explore learning resources <ArrowRight size={16} /></button></div></section>}<BotPet storageKey="aiwrevolusi.botPetPosition.possibilities.v1" speech={petSpeech} onSpeechDismiss={dismissPet} onPetTap={nudgePet} /></div>;
}

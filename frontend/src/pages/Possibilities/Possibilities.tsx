import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { possibilitiesService } from "@/services/possibilitiesService";
import { accountStorage, currentWorkspaceSession, flushWorkspace } from "@/services/accountStorage";
import {
  readTaskWorkspace,
} from "@/features/work-profile/userProfile";
import {
  loadSavedPossibilities,
  possibilitiesProfilePath,
  toPossibilitiesData,
  type PossibilitiesData,
} from "./possibilitiesModel";
import { Button } from "@/components/ui/button";
import Tooltip from "@/components/ui/tooltip";
import InfoHint from "@/components/common/InfoHint";
import { addCareerPathSkill, readCareerPath } from "@/features/skills/careerPath";
import { skillPathDescription } from "@/features/skills/skillPath";
import { skillMatch } from "./possibilitiesModel";
import { ROUTES } from "@/constants/routes";
import "./exploration.css";

const DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
const MATCH_HINT = "Based on skills connected to your work, tasks and learning. This indicates skill overlap, not job suitability.";
const GAP_HINT = "No connection has been found in your current records. This does not mean you do not have this skill.";
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = accountStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

export default function Possibilities() {
  const navigate = useNavigate();
  const alive = useRef(true);
  const profilePath = possibilitiesProfilePath(readTaskWorkspace());
  const [data, setData] = useState<PossibilitiesData | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(
    () => readJson<{ occupation_code?: string } | null>(DIRECTION_KEY, null)?.occupation_code ?? null,
  );
  const [skillChoice, setSkillChoice] = useState<{ careerCode: string; skillId: number } | null>(() => {
    const saved = readJson<{ occupation_code?: string; skill_id?: number } | null>(DIRECTION_KEY, null);
    return saved?.occupation_code && saved.skill_id ? { careerCode: saved.occupation_code, skillId: saved.skill_id } : null;
  });
  const [navigationError, setNavigationError] = useState("");
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    const owner = currentWorkspaceSession();
    void loadSavedPossibilities({
      signal: controller.signal,
      flush: flushWorkspace,
      get: possibilitiesService.getPossibilities,
      onSuccess: (response) => {
        if (owner !== currentWorkspaceSession()) return;
        const mapped = toPossibilitiesData(response);
        setData(mapped);
        setError("");
        setLoading(false);
        setSelectedCode(current => {
          const candidate = current ?? response.chosen_direction_code;
          return mapped.directions.some(direction => direction.occupation_code === candidate)
            ? candidate
            : null;
        });
      },
      onError: err => {
        if (owner !== currentWorkspaceSession()) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not save your work profile or load career exploration. Please try again.",
        );
        setLoading(false);
      },
    });
    return () => { alive.current = false; controller.abort(); };
  }, []);

  const choose = (code: string) => {
    if (continuing) return;
    const direction = data?.directions.find(item => item.occupation_code === code);
    if (!direction) return;
    try {
      accountStorage.setItem(DIRECTION_KEY, JSON.stringify({ occupation_code: code, title: direction.title, skillSources: readCareerPath().sources }));
      setSelectedCode(code);
      setSkillChoice(current => current?.careerCode === code ? current : null);
      setNavigationError("");
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : "Could not save this direction.");
    }
  };

  if (loading) {
    return (
      <div className="px-page">
        <p role="status">Loading career options…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="px-page">
        <p role="alert">{error || "Career options are unavailable."}</p>
        <Link to={profilePath}>Review your work profile</Link>
      </div>
    );
  }
  if (data.status === "needs_profile") {
    return (
      <div className="px-page">
        <PageHeader title="Career options" description="Explore directions based on your work profile." />
        <section className="px-no-direction">
          <h2>Complete your Work Profile</h2>
          <p>Confirm your current role and tasks first so we can show relevant directions.</p>
          <Link className="px-primary" to={profilePath}>
            Go to Work Profile <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    );
  }
  if (data.status === "unavailable") {
    return (
      <div className="px-page">
        <p role="alert">Career options are temporarily unavailable. Please try again later.</p>
      </div>
    );
  }

  const selected = data.directions.find(item => item.occupation_code === selectedCode);
  const currentTitle = data.currentRole?.title ?? "Your current role";
  const identifiedProfileSkills = data.skills.filter(item => item.state === "have" || item.state === "suggested" || item.state === "learning");
  const availableSkills = (selected?.skills ?? []).filter(item => item.state !== "have").sort((a, b) => Number(["suggested", "learning"].includes(a.state)) - Number(["suggested", "learning"].includes(b.state)));
  let careerIds: number[] = [];
  let careerError = "";
  try { careerIds = readCareerPath().ids; } catch (error) { careerError = error instanceof Error ? error.message : "Could not read saved skills."; }
  const selectedSkill = skillChoice?.careerCode === selected?.occupation_code
    ? availableSkills.find(item => item.skill_id === skillChoice?.skillId) : undefined;
  const goLearning = async (skillId = selectedSkill?.skill_id) => {
    if (!selected || !skillId || continuing) return;
    const skill = availableSkills.find(item => item.skill_id === skillId);
    if (!skill) return;
    try {
      setContinuing(true);
      setNavigationError("");
      const owner = currentWorkspaceSession();
      await addCareerPathSkill(skill.skill_id, selected.occupation_code, selected.title);
      if (alive.current && owner === currentWorkspaceSession()) navigate(`${ROUTES.skills}?careerSkill=${skill.skill_id}#skill-area-${skill.skill_id}`);
    } catch (error) {
      if (!alive.current) return;
      setNavigationError(error instanceof Error ? error.message : "Could not save your skill. Please try again.");
      setContinuing(false);
    }
  };

  const unmatched = availableSkills.filter(skill => !["have", "suggested", "learning"].includes(skill.state));
  const matchedOptions = availableSkills.filter(skill => ["have", "suggested", "learning"].includes(skill.state));
  const renderSkill = (skill: (typeof availableSkills)[number]) => {
          if (!selected) return null;
          const chosen = selectedSkill?.skill_id === skill.skill_id;
          const saved = careerIds.includes(skill.skill_id);
          const missing = !["have", "suggested", "learning"].includes(skill.state);
          return <label key={skill.skill_id} className={`px-development-card ${chosen ? "is-selected" : ""} ${missing ? "is-missing" : ""}`}>
            <input type="radio" name="career-learning-skill" value={skill.skill_id} checked={chosen} onChange={() => { setSkillChoice({ careerCode: selected.occupation_code, skillId: skill.skill_id }); setNavigationError(""); }} />
            <span><strong>{skill.name}</strong><span className="px-skill-badges">{missing && <small className="px-gap-count">Not matched yet</small>}{saved && <small>In your Skill Path</small>}{!missing && <small>{skill.state === "learning" ? "From courses or learning" : "Suggested from tasks"}</small>}</span><p>{skillPathDescription(skill.skill_id)}</p></span>{chosen && <Check size={18} aria-hidden="true" />}
          </label>;
        };

  return <div className="px-page">
    <PageHeader title="Career possibilities" description="Explore career matches, choose a skill to develop and take your next step in Skill Path." />
    <div className="px-career-layout"><main className="px-career-main">
    <section className="px-current">
      <div><p className="px-eyebrow">YOUR STARTING POINT</p><h2>{currentTitle}</h2><Link className="px-light" to={profilePath}>Review work profile</Link></div>
      <div><h3>Skills in your profile</h3><div className="px-chips">{identifiedProfileSkills.map(skill => <span className="px-chip have" key={skill.skill_id}>{skill.name}</span>)}</div></div>
    </section>
    <section className="px-options">
      <p className="px-eyebrow">EXPLORE OTHER DIRECTIONS</p><h2>Where could you go next?</h2>
      <p className="px-match-help">About skill matching <InfoHint label="About skill matching and sources" text={[MATCH_HINT, data.careerSourceNote].filter(Boolean).join(" ")} /></p>
      {!data.directions.length && <div className="px-no-direction"><h3>No matching career options yet</h3><Link to={profilePath}>Update my tasks</Link></div>}
      <div className="px-direction-grid">{data.directions.map((direction, index) => {
        const match = skillMatch(direction.skills);
        const chosen = selectedCode === direction.occupation_code;
        return <article className={`px-direction-card px-accent-${index % 3} ${chosen ? "is-chosen" : ""}`} key={direction.occupation_code}>
          <div className="px-career-top"><div>{index === 0 && <span className="px-best-match">Top suggested direction</span>}<Tooltip title={direction.title}><h3 tabIndex={0}>{direction.title}</h3></Tooltip>{direction.area && <p className="px-career-area">{direction.area}</p>}</div>
            <div className="px-career-score"><svg viewBox="0 0 100 100" role="img" aria-label={match.percent === null ? "Match unavailable" : `${match.percent}% skill match`}><circle cx="50" cy="50" r="42" fill="none" stroke="#e8edf5" strokeWidth="9" />{match.percent !== null && <circle cx="50" cy="50" r="42" fill="none" stroke="#4f91ba" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${match.percent * 2.639} 263.9`} transform="rotate(-90 50 50)" />}<text x="50" y="56" textAnchor="middle">{match.percent === null ? "—" : `${match.percent}%`}</text></svg></div>
          </div>
          <div className="px-description-row"><Tooltip title={direction.description || "Explore the skills connected to this career direction."}><p tabIndex={0} className="px-career-description">{direction.description || "Explore the skills connected to this career direction."}</p></Tooltip></div>
          <Tooltip title={direction.skills.filter(skill => ["have", "suggested", "learning"].includes(skill.state)).map(skill => `${skill.name} (${skill.state === "have" ? "work profile" : skill.state === "learning" ? "courses or learning" : "task suggestion"})`).join("; ") || "No matched skills yet."}><p tabIndex={0} className="px-match-summary">{match.matched} of {match.total} skills matched</p></Tooltip>
          <div className="px-career-skill-group"><h4>SKILLS TO BUILD</h4><div className="px-career-tags is-building">{direction.skills.filter(skill => !["have", "suggested", "learning"].includes(skill.state)).map(skill => <span key={skill.skill_id}>{skill.name}</span>)}{match.total === match.matched && <small>{match.total ? "All identified skills have a connection" : "Match unavailable"}</small>}</div></div>
          <button className={chosen ? "px-primary" : "px-outline"} type="button" disabled={continuing} aria-pressed={chosen} onClick={() => choose(direction.occupation_code)}>{chosen ? "Chosen direction" : "Explore this direction"}<ArrowRight size={15} /></button>
        </article>;
      })}</div>
    </section>
    {selected && <section className="px-chosen" aria-labelledby="px-chosen-title">
      <p className="px-eyebrow">YOUR NEXT STEP</p><h2 id="px-chosen-title">Choose your next skill</h2><p>Skills to explore for {selected.title}.</p>
      <fieldset className="px-development" disabled={continuing || Boolean(careerError)}>
        <legend>Skills to develop · {unmatched.length || matchedOptions.length} <InfoHint label="About not matched skills" text={GAP_HINT} /></legend>
        <p>Choose one skill to add to your Skill Path.</p>
        <div className="px-development-grid">{(unmatched.length ? unmatched : matchedOptions).map(renderSkill)}</div>
        <div className="px-matched-actions">{unmatched.length > 0 && matchedOptions.length > 0 ? <details className="px-other-skills" key={selected.occupation_code}><summary>Develop a matched skill instead · {matchedOptions.length}</summary><div className="px-development-grid">{matchedOptions.map(renderSkill)}</div></details> : <span className="px-matched-label">Develop a matched skill instead · {matchedOptions.length}</span>}<Button disabled={!selectedSkill || continuing || Boolean(careerError)} onClick={() => { void goLearning(); }}>{continuing ? "Saving your skill…" : "Add to Skill Path"}<ArrowRight size={15} /></Button></div>
        {!availableSkills.length && <p>No additional skills are available for this direction.</p>}
      </fieldset>
    </section>}
    </main>
    <aside className="px-companion" aria-label="Journey Companion">
      <p className="px-eyebrow">JOURNEY COMPANION</p>
      <div className="px-companion-avatar"><img src="/images/possibilities-companion.png" alt="Your virtual career companion" width={280} height={320} /></div>
      <div className="px-companion-story"><h3>{selected ? "Your next chapter" : "Pick a direction to begin"}</h3><p>{selected ? `${currentTitle} → ${selected.title}` : "Explore a career direction, then choose a skill you would like to develop."}</p>{selectedSkill && <p>Selected skill: <strong>{selectedSkill.name}</strong></p>}</div>
      <Button className="px-primary px-companion-cta" onClick={() => { alive.current = false; navigate(ROUTES.resumeBuilder); }}>Generate resume<ArrowRight size={15} /></Button>
    </aside></div>
    {(navigationError || careerError) && <p role="alert">{navigationError || careerError}</p>}
  </div>;
}

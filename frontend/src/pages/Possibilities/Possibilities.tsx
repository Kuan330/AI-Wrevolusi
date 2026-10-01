import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Info } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { possibilitiesService } from "@/services/possibilitiesService";
import { referenceService } from "@/services/referenceService";
import { accountStorage, currentWorkspaceSession, flushWorkspace } from "@/services/accountStorage";
import { buildSkillEvidence } from "../../features/skills/skillProfile.ts";
import {
  readTaskWorkspace,
} from "@/features/work-profile/userProfile";
import type { WefSkill } from "@/types/reference";
import {
  acceptedCareerEvidence,
  loadSavedPossibilities,
  possibilitiesProfilePath,
  toPossibilitiesData,
  type PossibilitiesData,
} from "./possibilitiesModel";
import { isSkillReviewCurrent, readJourneyProfile, readJourneyState, startLearning } from "@/features/journey/journey";
import { ROUTES } from "@/constants/routes";
import "./exploration.css";

const DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
const COMPANION_AVATAR = "/images/possibilities-companion.png";
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = accountStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

function JourneyCompanion({
  currentTitle,
  targetTitle,
  acceptedSkills,
  suggestedSkillCount,
  developingSkillCount,
  onExplore,
  canExplore,
  continuing,
}: {
  currentTitle: string;
  targetTitle: string | null;
  acceptedSkills: { skill_id: number; name: string }[];
  suggestedSkillCount: number;
  developingSkillCount: number;
  onExplore: () => void;
  canExplore: boolean;
  continuing: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setDetailsOpen(false);
  }, [targetTitle]);

  return (
    <aside className="px-companion">
      <p className="px-eyebrow">Journey Companion</p>
      <div className="px-companion-avatar">
        <img
          src={COMPANION_AVATAR}
          alt="AI career companion"
          width={280}
          height={320}
          decoding="async"
        />
      </div>
      {targetTitle ? (
        <>
          <p className="px-companion-path">
            <span>{currentTitle}</span>
            <ArrowRight size={14} aria-hidden />
            <span>{targetTitle}</span>
          </p>

          <div className="px-companion-evidence">
            <strong>{acceptedSkills.length} current · {suggestedSkillCount} task suggestions · {developingSkillCount} to develop</strong>
            <p className="px-chosen-hint">WEF skills · occupation task matches</p>
            <button type="button" className="px-info-button"
              aria-label={detailsOpen ? "Hide career details" : "Show career details"}
              title={detailsOpen ? "Hide career details" : "Show career details"}
              aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
              <Info size={17} aria-hidden />
            </button>
            {detailsOpen ? (
              <div className="px-companion-story" id="px-companion-details">
                <h3>What this path suggests</h3>
                {acceptedSkills.length > 0 && <ul>{acceptedSkills.map(skill => <li key={skill.skill_id}>{skill.name}</li>)}</ul>}
                <p>Other role skills can be chosen for learning.</p>
              </div>
            ) : null}
          </div>

          <button className="px-primary px-companion-cta" type="button" disabled={!canExplore || continuing} onClick={onExplore}>
            {continuing ? "Opening learning resources…" : canExplore ? "Find learning for selected skill" : "Choose a skill to continue"}
          </button>
        </>
      ) : (
        <div className="px-companion-story">
          <h3>Pick a direction to begin</h3>

        </div>
      )}
    </aside>
  );
}

export default function Possibilities() {
  const navigate = useNavigate();
  const profilePath = possibilitiesProfilePath(readTaskWorkspace());
  const [data, setData] = useState<PossibilitiesData | null>(null);
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(
    () => readJson<{ occupation_code?: string } | null>(DIRECTION_KEY, null)?.occupation_code ?? null,
  );
  const [skillChoice, setSkillChoice] = useState<{ careerCode: string; skillId: number } | null>(() => {
    const saved = readJson<{ occupation_code?: string; skill_id?: number } | null>(DIRECTION_KEY, null);
    return saved?.occupation_code && saved.skill_id ? { careerCode: saved.occupation_code, skillId: saved.skill_id } : null;
  });
  const [navigationError, setNavigationError] = useState("");
  const [continuing, setContinuing] = useState(false);
  const [wefError, setWefError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const owner = currentWorkspaceSession();
    void referenceService
      .wefSkills()
      .then((rows) => {
        if (!cancelled && owner === currentWorkspaceSession()) {
          setWefSkills(
            [...rows].sort(
              (left, right) => left.wef_skill_id - right.wef_skill_id,
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled && owner === currentWorkspaceSession()) setWefError("The WEF skill framework could not be loaded. Reload to choose a supported learning skill.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  useEffect(() => {
    const changed = () => setWorkspaceRevision(value => value + 1);
    window.addEventListener("workspace-change", changed);
    return () => window.removeEventListener("workspace-change", changed);
  }, []);
  const reviewedEvidence = useMemo(() => {
    void workspaceRevision;
    try {
      const evidence = buildSkillEvidence(readJourneyProfile()?.tasks ?? [], wefSkills);
      return { skills: acceptedCareerEvidence(evidence, isSkillReviewCurrent(), readJourneyState().review?.decisions ?? {}), error: "" };
    } catch (error) {
      return { skills: [], error: error instanceof Error ? error.message : "Could not read your skill review." };
    }
  }, [wefSkills, workspaceRevision]);
  const reflectedSkills = reviewedEvidence.skills;

  useEffect(() => {
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
    return () => controller.abort();
  }, []);

  const choose = (code: string) => {
    if (continuing) return;
    const direction = data?.directions.find(item => item.occupation_code === code);
    if (!direction) return;
    try {
      accountStorage.setItem(DIRECTION_KEY, JSON.stringify({ occupation_code: code, title: direction.title }));
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
  const taskSuggestedSkills = data.skills.filter(item => item.state === "suggested");
  const developingProfileSkills = data.skills.filter(item => item.state === "learning");
  const selectedAcceptedSkills = (selected?.skills ?? []).filter(item => item.state === "have");
  const availableSkills = (selected?.skills ?? []).filter(item => item.state !== "have");
  const selectedSkill = skillChoice?.careerCode === selected?.occupation_code
    ? availableSkills.find(item => item.skill_id === skillChoice?.skillId) : undefined;
  const goLearning = async (skillId = selectedSkill?.skill_id) => {
    if (!selected || !skillId || continuing) return;
    const skill = availableSkills.find(item => item.skill_id === skillId);
    if (!skill) return;
    try {
      setContinuing(true);
      setNavigationError("");
      const destination = await startLearning({
        origin: "career",
        skill: { id: skill.skill_id, slug: skill.skill_slug, name: skill.name },
        career: { code: selected.occupation_code, title: selected.title },
        goal: `Develop ${skill.name} for ${selected.title}`,
      });
      navigate(destination);
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : "Could not open learning resources.");
      setContinuing(false);
    }
  };

  return (
    <div className="px-page">
      <PageHeader
        title="Career options"
        description="Grow in your current role, or explore where your experience could take you next."
      />
      {data.careerSourceNote && <details className="px-info-disclosure px-source-note">
        <summary aria-label="Show career source information" title="Career source information"><Info size={17} aria-hidden /></summary>
        <p>{data.careerSourceNote}</p>
      </details>}
      {reviewedEvidence.error && <p role="alert">{reviewedEvidence.error}</p>}
      <div className="px-body">
        <div className="px-main-col">
          <section className="px-current">
            <div className="px-current-intro">
              <p className="px-eyebrow">YOUR STARTING POINT</p>
              <h2>{currentTitle}</h2>

              <Link className="px-light" to={profilePath}>
                Review work profile
              </Link>
            </div>
            <div className="px-current-skills">
              <div className="px-profile-skills-heading">
                <h3>Skills in your profile</h3>
                <details className="px-info-disclosure">
                  <summary aria-label="Show skill source information" title="Skill source information"><Info size={16} aria-hidden /></summary>
                  <p>Directions use WEF skills suggested by your confirmed tasks. No review is needed.</p>
                </details>
              </div>
              <div className="px-chips">
                {reflectedSkills.length > 0 ? (
                  reflectedSkills.map(({ skill }) => (
                    <span className="px-chip have" key={skill.wef_skill_id}>
                      {skill.core_skill}
                    </span>
                  ))
                ) : (
                  <p className="px-chosen-hint">No accepted WEF skills yet.</p>
                )}
              </div>
              {wefError && <p role="status" className="px-chosen-hint">{wefError}</p>}
              {taskSuggestedSkills.length > 0 && <>
                <h3 className="mt-4">Suggested from your tasks</h3>
                <div className="px-chips">{taskSuggestedSkills.map(skill => <span className="px-chip missing" key={skill.skill_id}>{skill.name}</span>)}</div>
              </>}
              {developingProfileSkills.length > 0 && <>
                <h3 className="mt-4">Skills to develop</h3>
                <div className="px-chips">{developingProfileSkills.map(skill => <span className="px-chip missing" key={skill.skill_id}>{skill.name}</span>)}</div>
              </>}
            </div>
          </section>

          <section className="px-options">
            <p className="px-eyebrow">EXPLORE OTHER DIRECTIONS</p>
            <h2>Where could you go next?</h2>
            {!data.directions.length && <div className="px-no-direction">
              {data.status === "needs_skill_review" ? <><h3>No task skills found yet</h3><Link className="px-light" to={ROUTES.workProfile}>Update my tasks</Link></> : <><h3>No matching career options yet</h3><Link className="px-light" to={ROUTES.workProfile}>Update my tasks</Link></>}
            </div>}
            <div className="px-direction-grid">
              {data.directions.slice(0, 3).map((direction, index) => {
                const chosen = selected?.occupation_code === direction.occupation_code;
                const acceptedSkills = direction.skills.filter(skill => skill.state === "have");
                return (
                  <article
                    className={`px-direction-card px-accent-${index} ${chosen ? "is-chosen" : ""}`}
                    key={direction.occupation_code}
                  >
                    {direction.area ? <p className="px-eyebrow">{direction.area}</p> : null}
                    <h3>{direction.title}</h3>
                    <div className="px-card-evidence">
                      <strong>{acceptedSkills.length} current skill{acceptedSkills.length === 1 ? "" : "s"} in common</strong>
                      <span>{direction.suggested_skill_overlap} task suggestions · {direction.developing_skill_overlap} to develop</span>
                      <p>{acceptedSkills.map(skill => skill.name).join(" · ")}</p>
                    </div>
                    {direction.description && <details className="px-info-disclosure px-role-info">
                      <summary aria-label={`Show ${direction.title} description`} title="Role description"><Info size={16} aria-hidden /></summary>
                      <p>{direction.description}</p>
                    </details>}
                    <p className="px-card-source">WEF skills · occupation task matches</p>
                    <button
                      className={chosen ? "px-primary" : "px-outline"}
                      type="button"
                      onClick={() => choose(direction.occupation_code)}
                    >
                      {chosen ? "Chosen direction" : "Explore this direction"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {selected ? (
            <section className="px-chosen" aria-labelledby="px-chosen-title">
              <p className="px-eyebrow">03 · MY CHOSEN DIRECTION</p>
              <h2 id="px-chosen-title">Your path to {selected.title}</h2>
              {selected.description && <details className="px-info-disclosure px-role-info">
                <summary aria-label={`Show ${selected.title} description`} title="Role description"><Info size={16} aria-hidden /></summary>
                <p>{selected.description}</p>
              </details>}
              {selected.skills.length > 0 ? (
                <div className="px-chosen-skills">
                  <div className="px-skill-split">
                    <div>
                      <h3>Skills you said you use</h3>
                      <div className="px-chips px-chips--path">
                        {selectedAcceptedSkills
                          .map(skill => (
                            <span className="px-chip have" key={skill.skill_id}>
                              <Check size={13} aria-hidden />
                              {skill.name}
                            </span>
                          ))}
                      </div>
                      {!selectedAcceptedSkills.length && <p className="px-chosen-hint">No current skills in common yet.</p>}
                    </div>
                    <div>
                      <h3>Skills for this role</h3>
                      <ul className="px-requirement-list">{selected.skills.map(skill => <li key={skill.skill_id}>
                        <strong>{skill.name}</strong><span>{skill.state === "have" ? "Fits my work" : skill.state === "learning" ? "To develop" : "Not yet selected"}</span>
                      </li>)}</ul>
                    </div>
                  </div>
                </div>
              ) : null}
              <fieldset className="mt-5 space-y-3" disabled={continuing}>
                <legend className="font-semibold">Choose a skill to develop</legend>
                <details className="px-info-disclosure">
                  <summary aria-label="Show role skill information" title="Role skill information"><Info size={16} aria-hidden /></summary>
                  <p>Skills are matched from WEF labels and occupation task descriptions.</p>
                </details>
                {availableSkills.map(item => (
                  <label key={item.skill_id} className="flex items-center gap-2">
                    <input type="radio" name="career-learning-skill" value={item.skill_id}
                      checked={selectedSkill?.skill_id === item.skill_id}
                      onChange={() => {
                        setSkillChoice({ careerCode: selected.occupation_code, skillId: item.skill_id });
                        try { accountStorage.setItem(DIRECTION_KEY, JSON.stringify({ occupation_code: selected.occupation_code, title: selected.title, skill_id: item.skill_id })); setNavigationError(""); }
                        catch (error) { setNavigationError(error instanceof Error ? error.message : "Could not save your skill choice."); }
                      }} />
                    {item.name}{item.state === "learning" ? " · already in development" : ""}
                  </label>
                ))}
                {!availableSkills.length && <p role="status">No additional skills to explore.</p>}
              </fieldset>
              <details className="px-info-disclosure px-source-details">
                <summary aria-label="Show career source and date" title="Career source and date"><Info size={16} aria-hidden /></summary>
                <p>WEF skill labels matched against occupation task descriptions.</p>
              </details>
              {navigationError && <p role="alert" className="mt-3">{navigationError}</p>}
              <button className="px-primary mt-4" type="button" disabled={!selectedSkill || continuing} onClick={() => { void goLearning(); }}>
                {continuing ? "Opening learning resources…" : selectedSkill ? `Develop ${selectedSkill.name}` : "Choose a skill to continue"}
              </button>
            </section>
          ) : null}
        </div>

        <JourneyCompanion
          currentTitle={currentTitle}
          targetTitle={selected?.title ?? null}
          acceptedSkills={selectedAcceptedSkills}
          suggestedSkillCount={selected?.suggested_skill_overlap ?? 0}
          developingSkillCount={selected?.developing_skill_overlap ?? 0}
          onExplore={() => { void goLearning(); }}
          canExplore={Boolean(selectedSkill)}
          continuing={continuing}
        />
      </div>

    </div>
  );
}

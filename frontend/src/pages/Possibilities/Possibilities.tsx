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
import { isSkillReviewCurrent, readJourneyProfile, readJourneyState } from "@/features/journey/journey";
import { ROUTES } from "@/constants/routes";
import "./exploration.css";

const DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
const COMPANION_AVATAR = "/images/possibilities-companion.png";
const sourceRetrievedDate = (value: string) => Number.isNaN(Date.parse(value))
  ? "date not recorded"
  : new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(value));

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
  onExplore,
  canExplore,
  continuing,
}: {
  currentTitle: string;
  targetTitle: string | null;
  acceptedSkills: { uri: string; label: string }[];
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
            <strong>{acceptedSkills.length} reviewed skill{acceptedSkills.length === 1 ? "" : "s"} in common</strong>
            <p className="px-chosen-hint">ESCO source links · exploratory</p>
            <button type="button" className="px-info-button"
              aria-label={detailsOpen ? "Hide career details" : "Show career details"}
              title={detailsOpen ? "Hide career details" : "Show career details"}
              aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
              <Info size={17} aria-hidden />
            </button>
            {detailsOpen ? (
              <div className="px-companion-story" id="px-companion-details">
                <h3>What this path suggests</h3>
                <p>
                  This direction uses ESCO occupation-skill relationships. Shared skills below are ones you said you use in current confirmed work.
                </p>
                {acceptedSkills.length > 0 && <ul>{acceptedSkills.map(skill => <li key={skill.uri}>{skill.label}</li>)}</ul>}
                <p>Other requirements are not evidence that you lack a skill. Choose one to explore learning.</p>
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
    () => readJson<{ occupation_uri?: string } | null>(DIRECTION_KEY, null)?.occupation_uri ?? null,
  );
  const [skillChoice, setSkillChoice] = useState<{ careerUri: string; skillUri: string } | null>(() => {
    const saved = readJson<{ occupation_uri?: string; skill_uri?: string } | null>(DIRECTION_KEY, null);
    return saved?.occupation_uri && saved.skill_uri ? { careerUri: saved.occupation_uri, skillUri: saved.skill_uri } : null;
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
          const candidate = current ?? response.chosen_direction_uri;
          return mapped.directions.some(direction => direction.occupation_uri === candidate)
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

  const choose = (uri: string) => {
    if (continuing) return;
    const direction = data?.directions.find(item => item.occupation_uri === uri);
    if (!direction) return;
    try {
      accountStorage.setItem(DIRECTION_KEY, JSON.stringify({ occupation_uri: uri, occupation_code: direction.occupation_code, title: direction.title }));
      setSelectedCode(uri);
      setSkillChoice(current => current?.careerUri === uri ? current : null);
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

  const selected = data.directions.find(item => item.occupation_uri === selectedCode);
  const currentTitle = data.currentRole?.title ?? "Your current role";
  const selectedAcceptedSkills = (selected?.requirements ?? []).filter(item => item.state === "current");
  const availableSkills = (selected?.requirements ?? []).filter(item => item.relation === "essential" && item.state !== "current");
  const selectedSkill = skillChoice?.careerUri === selected?.occupation_uri
    ? availableSkills.find(item => item.uri === skillChoice?.skillUri) : undefined;
  const goLearning = (skillUri = selectedSkill?.uri) => {
    if (!selected || !skillUri || continuing) return;
    const skill = availableSkills.find(item => item.uri === skillUri);
    if (!skill) return;
    const saved = { occupation_uri: selected.occupation_uri, occupation_code: selected.occupation_code,
      title: selected.title, skill_uri: skill.uri, skill_label: skill.label,
      source_version: selected.source.version };
    try {
      accountStorage.setItem(DIRECTION_KEY, JSON.stringify(saved));
      setSelectedCode(selected.occupation_uri);
      setSkillChoice({ careerUri: selected.occupation_uri, skillUri: skill.uri });
      setContinuing(true);
      setNavigationError("");
      const query = new URLSearchParams({
        mode: "browse", search: skill.label, careerSkill: skill.label,
        careerSkillUri: skill.uri, careerRole: selected.title,
        careerRoleUri: selected.occupation_uri, careerSourceVersion: selected.source.version,
      });
      navigate(`${ROUTES.learningCentre}?${query.toString()}`);
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
                  <p>These are WEF skills from your current review. Career directions use ESCO skills.</p>
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
                  <p className="px-chosen-hint">No reviewed skills yet.</p>
                )}
              </div>
              {wefError && <p role="status" className="px-chosen-hint">{wefError}</p>}
              {data.reviewedEscoSkills.length > 0 && <>
                <h3 className="mt-4">ESCO skills linked to confirmed tasks</h3>
                <details className="px-info-disclosure">
                  <summary aria-label="Show ESCO skill information" title="ESCO skill information"><Info size={16} aria-hidden /></summary>
                  <p>“Current” means you said you use the skill for a confirmed task. It is not a proficiency rating.</p>
                </details>
                <div className="px-chips">{data.reviewedEscoSkills.map(skill => <span className={`px-chip ${skill.state === "current" ? "have" : "missing"}`} key={skill.uri}>{skill.label}{skill.state === "developing" ? " · developing" : ""}</span>)}</div>
              </>}
            </div>
          </section>

          <section className="px-options">
            <p className="px-eyebrow">EXPLORE OTHER DIRECTIONS</p>
            <h2>Where could you go next?</h2>
            {!data.directions.length && <div className="px-no-direction">
              {data.status === "needs_skill_review" ? <><h3>Review skills to see career options</h3><Link className="px-light" to={ROUTES.skills}>Review skills for my tasks</Link></> : <><h3>No matching career options yet</h3><Link className="px-light" to={ROUTES.skills}>Review skills for my tasks</Link></>}
            </div>}
            <div className="px-direction-grid">
              {data.directions.slice(0, 3).map((direction, index) => {
                const chosen = selected?.occupation_uri === direction.occupation_uri;
                const acceptedSkills = direction.requirements.filter(skill => skill.state === "current");
                return (
                  <article
                    className={`px-direction-card px-accent-${index} ${chosen ? "is-chosen" : ""}`}
                    key={direction.occupation_uri}
                  >
                    {direction.area ? <p className="px-eyebrow">{direction.area}</p> : null}
                    <h3>{direction.title}</h3>
                    <div className="px-card-evidence">
                      <strong>{acceptedSkills.length} reviewed skill{acceptedSkills.length === 1 ? "" : "s"} in common</strong>
                      <span>{direction.developing_skill_overlap} developing connection{direction.developing_skill_overlap === 1 ? "" : "s"} · {direction.essential_not_yet_evidenced} essential skill{direction.essential_not_yet_evidenced === 1 ? "" : "s"} not yet evidenced</span>
                      <p>{acceptedSkills.map(skill => skill.label).join(" · ")}</p>
                    </div>
                    {direction.description && <details className="px-info-disclosure px-role-info">
                      <summary aria-label={`Show ${direction.title} description`} title="Role description"><Info size={16} aria-hidden /></summary>
                      <p>{direction.description}</p>
                    </details>}
                    <p className="px-card-source">Source: ESCO {direction.source.version} · snapshot retrieved {sourceRetrievedDate(direction.source.retrieved_at)}</p>
                    <a className="px-card-source-link" href={direction.occupation_uri} target="_blank" rel="noreferrer">View this ESCO occupation record</a>
                    <button
                      className={chosen ? "px-primary" : "px-outline"}
                      type="button"
                      onClick={() => choose(direction.occupation_uri)}
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
              {selected.requirements.length > 0 ? (
                <div className="px-chosen-skills">
                  <div className="px-skill-split">
                    <div>
                      <h3>Skills you said you use</h3>
                      <div className="px-chips px-chips--path">
                        {selectedAcceptedSkills
                          .map(skill => (
                            <span className="px-chip have" key={skill.uri}>
                              <Check size={13} aria-hidden />
                              {skill.label}
                            </span>
                          ))}
                      </div>
                      {!selectedAcceptedSkills.length && <p className="px-chosen-hint">No current-use skill evidence is linked to this role. This does not establish a skill gap.</p>}
                    </div>
                    <div>
                      <h3>Role skills and their source labels</h3>
                      <ul className="px-requirement-list">{selected.requirements.map(skill => <li key={skill.uri}>
                        <strong><a href={skill.uri} target="_blank" rel="noreferrer">{skill.label}</a></strong><span>{skill.relation} · {skill.state === "current" ? "you said you use this" : skill.state === "developing" ? "you marked this to develop" : "not evidenced in this review"}</span>
                      </li>)}</ul>
                    </div>
                  </div>
                </div>
              ) : null}
              <fieldset className="mt-5 space-y-3" disabled={continuing}>
                <legend className="font-semibold">Choose one essential skill to explore</legend>
                <details className="px-info-disclosure">
                  <summary aria-label="Show role skill information" title="Role skill information"><Info size={16} aria-hidden /></summary>
                  <p>Role skills are from ESCO v{selected.source.version}. Skills absent from your review are not assumed missing.</p>
                </details>
                {availableSkills.map(item => (
                  <label key={item.uri} className="flex items-center gap-2">
                    <input type="radio" name="career-learning-skill" value={item.uri}
                      checked={selectedSkill?.uri === item.uri}
                      onChange={() => {
                        setSkillChoice({ careerUri: selected.occupation_uri, skillUri: item.uri });
                        try { accountStorage.setItem(DIRECTION_KEY, JSON.stringify({ occupation_uri: selected.occupation_uri, occupation_code: selected.occupation_code, title: selected.title, skill_uri: item.uri, skill_label: item.label, source_version: selected.source.version })); setNavigationError(""); }
                        catch (error) { setNavigationError(error instanceof Error ? error.message : "Could not save your skill choice."); }
                      }} />
                    {item.label}
                  </label>
                ))}
                {!availableSkills.length && <p role="status">No essential skills to explore.</p>}
              </fieldset>
              <details className="px-info-disclosure px-source-details">
                <summary aria-label="Show career source and date" title="Career source and date"><Info size={16} aria-hidden /></summary>
                <p>{selected.source.attribution}</p>
                <p>ESCO {selected.source.version} · snapshot retrieved {sourceRetrievedDate(selected.source.retrieved_at)}</p>
                <a href={selected.source.occupation_uri} target="_blank" rel="noreferrer">Open this occupation in ESCO</a><br />
                <a href={selected.source.source_url} target="_blank" rel="noreferrer">Open the source catalogue archive</a>
              </details>
              {navigationError && <p role="alert" className="mt-3">{navigationError}</p>}
              <button className="px-primary mt-4" type="button" disabled={!selectedSkill || continuing} onClick={() => { void goLearning(); }}>
                {continuing ? "Opening learning resources…" : selectedSkill ? `Find learning for ${selectedSkill.label}` : "Choose a skill to continue"}
              </button>
            </section>
          ) : null}
        </div>

        <JourneyCompanion
          currentTitle={currentTitle}
          targetTitle={selected?.title ?? null}
          acceptedSkills={selectedAcceptedSkills}
          onExplore={() => { void goLearning(); }}
          canExplore={Boolean(selectedSkill)}
          continuing={continuing}
        />
      </div>

    </div>
  );
}

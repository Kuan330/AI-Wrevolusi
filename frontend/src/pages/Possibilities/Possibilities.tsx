import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Plus } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import PageHeader from "@/components/common/PageHeader";
import { possibilitiesService } from "@/services/possibilitiesService";
import { referenceService } from "@/services/referenceService";
import { accountStorage, currentWorkspaceSession, flushWorkspace } from "@/services/accountStorage";
import { PAGE_GRADIENT_CSS } from "@/constants/palette";
import SkillOutlookSummary from "@/pages/Skills/components/SkillOutlookSummary";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import {
  readTaskWorkspace,
} from "@/features/work-profile/userProfile";
import type { WefSkill } from "@/types/reference";
import {
  acceptedCareerEvidence,
  acceptedDirectionSkills,
  loadSavedPossibilities,
  possibilitiesProfilePath,
  toPossibilitiesData,
  type PossibilitiesData,
} from "./possibilitiesModel";
import { isSkillReviewCurrent, readJourneyProfile, readJourneyState, readLearningContext, startLearning } from "@/features/journey/journey";
import { skillKey } from "@/pages/Skills/learningSkills";
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

/** Skill outlook with the same career learning action as the page. */
function BuildSkillChip({
  skill,
  continuing,
  onLearn,
}: {
  skill: WefSkill;
  continuing: boolean;
  onLearn: () => void;
}) {
  const actionsRef = useRef<Popover.Root.Actions | null>(null);

  return (
    <Popover.Root actionsRef={actionsRef}>
      <Popover.Trigger
        nativeButton
        type="button"
        className="px-chip missing"
        aria-haspopup="dialog"
        title="View outlook and learn this skill for your chosen direction"
      >
        {skill.core_skill}
        <Plus size={13} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          className="z-[80]"
        >
          <Popover.Popup
            initialFocus={false}
            style={{ background: PAGE_GRADIENT_CSS }}
            className="w-[min(42rem,calc(100vw-1.5rem))] max-h-[var(--available-height)] overflow-y-auto rounded-xl border border-[#dfd5e4] p-2.5 pb-2 shadow-xl outline-none"
          >
            <SkillOutlookSummary
              skill={skill}
              compact
              showAddToLearning={false}
            />
            <button
              type="button"
              className="px-primary mt-3"
              disabled={continuing}
              onClick={() => { onLearn(); actionsRef.current?.close(); }}
            >
              {continuing ? "Saving your choice…" : "Learn this skill for this direction"}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

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
  acceptedSkills: { skill_id: number; name: string }[];
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
            <strong>{acceptedSkills.length ? `${acceptedSkills.length} accepted connection${acceptedSkills.length === 1 ? "" : "s"}` : "Needs review"}</strong>
            <p className="px-chosen-hint">Broad connections to explore</p>
            <button
              type="button"
              className={`px-companion-details-btn${detailsOpen ? " is-open" : ""}`}
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              {detailsOpen ? "Hide explanation" : "Details"}
              <ChevronDown size={14} aria-hidden />
            </button>
            {detailsOpen ? (
              <div className="px-companion-story" id="px-companion-details">
                <h3>What this path suggests</h3>
                <p>
                  This direction uses broad WEF skill links from occupation and task wording.
                  {acceptedSkills.length ? " These connections match skills you accepted in your current review." : " No accepted skill connections are shown in your current review yet."}
                </p>
                {acceptedSkills.length > 0 && <ul>{acceptedSkills.map(skill => <li key={skill.skill_id}>{skill.name}</li>)}</ul>}
                <p>Other skills, qualifications and experience have not been assessed. Choose a skill to explore a useful next step.</p>
              </div>
            ) : null}
          </div>

          <button className="px-primary px-companion-cta" type="button" disabled={!canExplore || continuing} onClick={onExplore}>
            {continuing ? "Saving your choice…" : canExplore ? "Continue with selected skill" : "Choose a skill to continue"}
          </button>
        </>
      ) : (
        <div className="px-companion-story">
          <h3>Pick a direction to begin</h3>
          <p className="px-companion-empty">
            Choose one of the roles below. Your companion will show how your
            current experience connects, then guide you to skills and learning
            steps for that path.
          </p>
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
  const [skillChoice, setSkillChoice] = useState<{ careerCode: string; id: number } | null>(() => {
    try {
      const saved = readLearningContext();
      return saved?.origin === "career" && saved.career ? { careerCode: saved.career.code, id: saved.skill.id } : null;
    } catch { return null; }
  });
  const [navigationError, setNavigationError] = useState("");
  const [continuing, setContinuing] = useState(false);
  const [wefError, setWefError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
  const reflectedSkillIds = useMemo(
    () => new Set(reflectedSkills.map(({ skill }) => skill.wef_skill_id)),
    [reflectedSkills],
  );
  const wefById = useMemo(
    () => new Map(wefSkills.map(skill => [skill.wef_skill_id, skill])),
    [wefSkills],
  );

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
          return mapped.directions.some((direction: any) => direction.occupation_code === candidate)
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
  const selectedAcceptedSkills = acceptedDirectionSkills(selected?.skills ?? [], reflectedSkillIds);
  const availableSkills = (selected?.skills ?? []).filter(item => {
    const wef = wefById.get(item.skill_id);
    return wef && item.skill_slug === skillKey(wef.core_skill);
  });
  const selectedSkill = skillChoice?.careerCode === selected?.occupation_code
    ? availableSkills.find(item => item.skill_id === skillChoice?.id) : undefined;
  const goLearning = async (skillId = selectedSkill?.skill_id) => {
    if (!selected || skillId == null || continuing || !availableSkills.some(item => item.skill_id === skillId)) return;
    const wef = wefById.get(skillId);
    if (!wef) return;
    const owner = currentWorkspaceSession();
    setContinuing(true);
    setSkillChoice({ careerCode: selected.occupation_code, id: skillId });
    setNavigationError("");
    try {
      const url = await startLearning({ origin: "career",
        skill: { id: wef.wef_skill_id, slug: skillKey(wef.core_skill), name: wef.core_skill },
        career: { code: selected.occupation_code, title: selected.title } });
      if (mounted.current && owner === currentWorkspaceSession()) navigate(url);
    } catch (error) {
      if (mounted.current && owner === currentWorkspaceSession()) setNavigationError(error instanceof Error ? error.message : "Could not save your skill choice. Please try again.");
    } finally {
      if (mounted.current && owner === currentWorkspaceSession()) setContinuing(false);
    }
  };

  return (
    <div className="px-page">
      <PageHeader
        title="Career options"
        description="Grow in your current role, or explore where your experience could take you next."
      />
      {reviewedEvidence.error && <p role="alert">{reviewedEvidence.error}</p>}
      <div className="px-body">
        <div className="px-main-col">
          <section className="px-current">
            <div className="px-current-intro">
              <p className="px-eyebrow">YOUR STARTING POINT</p>
              <h2>{currentTitle}</h2>
              <p>These connections come from your confirmed Work Profile.</p>
              <Link className="px-light" to={profilePath}>
                Review work profile
              </Link>
            </div>
            <div className="px-current-skills">
              <h3>Skills in your profile</h3>
              <p className="px-chosen-hint">
                Skills accepted in your current skill review.
              </p>
              <div className="px-chips">
                {reflectedSkills.length > 0 ? (
                  reflectedSkills.map(({ skill }) => (
                    <span className="px-chip have" key={skill.wef_skill_id}>
                      {skill.core_skill}
                    </span>
                  ))
                ) : (
                  <p className="px-chosen-hint">
                    No accepted skills from a current review yet. Review your skills before treating detected connections as current strengths.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="px-options">
            <p className="px-eyebrow">EXPLORE OTHER DIRECTIONS</p>
            <h2>Where could you go next?</h2>
            <div className="px-direction-grid">
              {data.directions.slice(0, 3).map((direction, index) => {
                const chosen = selected?.occupation_code === direction.occupation_code;
                const acceptedSkills = acceptedDirectionSkills(direction.skills, reflectedSkillIds);
                return (
                  <article
                    className={`px-direction-card px-accent-${index} ${chosen ? "is-chosen" : ""}`}
                    key={direction.occupation_code}
                  >
                    {direction.area ? <p className="px-eyebrow">{direction.area}</p> : null}
                    <h3>{direction.title}</h3>
                    <div className="px-card-evidence">
                      <strong>{acceptedSkills.length ? `${acceptedSkills.length} accepted connection${acceptedSkills.length === 1 ? "" : "s"}` : "Needs review"}</strong>
                      <span>Broad connections to explore</span>
                      {acceptedSkills.length > 0 && <p>{acceptedSkills.map(skill => skill.name).join(" · ")}</p>}
                    </div>
                    <p className="px-direction-description">{direction.description}</p>
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
              <p className="px-chosen-lead">
                {selected.area
                  ? `${selected.area} · broad WEF skill connections to explore.`
                  : "Broad WEF skill connections from occupation and task wording."}
              </p>
              {selected.description ? (
                <p className="px-chosen-copy">{selected.description}</p>
              ) : null}
              {selected.skills.length > 0 ? (
                <div className="px-chosen-skills">
                  <div className="px-skill-split">
                    <div>
                      <h3>Accepted skill connections</h3>
                      <div className="px-chips px-chips--path">
                        {selectedAcceptedSkills
                          .map(skill => (
                            <span className="px-chip have" key={skill.skill_id}>
                              <Check size={13} aria-hidden />
                              {skill.name}
                            </span>
                          ))}
                      </div>
                      {selected.skills.every(
                        skill => !reflectedSkillIds.has(skill.skill_id),
                      ) ? (
                        <p className="px-chosen-hint">No accepted skill connections in your current review yet. This does not establish a skill gap.</p>
                      ) : null}
                    </div>
                    <div>
                      <h3>Other connections to explore</h3>
                      <p className="px-chosen-hint">
                        These connections need review. Open a skill to see its outlook or learn it for this direction.
                      </p>
                      <div className="px-chips px-chips--path">
                        {selected.skills
                          .filter(skill => !reflectedSkillIds.has(skill.skill_id))
                          .map(skill => {
                            const wef = wefById.get(skill.skill_id);
                            if (!wef || skill.skill_slug !== skillKey(wef.core_skill)) {
                              return (
                                <span className="px-chip missing" key={skill.skill_id}>
                                  {skill.name}
                                  <Plus size={13} aria-hidden />
                                </span>
                              );
                            }
                            return (
                              <BuildSkillChip
                                key={skill.skill_id}
                                skill={wef}
                                continuing={continuing}
                                onLearn={() => { void goLearning(skill.skill_id); }}
                              />
                            );
                          })}
                      </div>
                      {selected.skills.every(skill =>
                        reflectedSkillIds.has(skill.skill_id),
                      ) ? (
                        <p className="px-chosen-hint">Other skill requirements have not been assessed.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <fieldset className="mt-5 space-y-3" disabled={continuing}>
                <legend className="font-semibold">Choose one skill for your next learning step</legend>
                <p className="px-chosen-hint">These are broad WEF skills linked by the current career model. They do not establish specialist requirements or prove a skill gap.</p>
                {availableSkills.map(item => (
                  <label key={item.skill_id} className="flex items-center gap-2">
                    <input type="radio" name="career-learning-skill" value={item.skill_id}
                      checked={selectedSkill?.skill_id === item.skill_id}
                      onChange={() => { setSkillChoice({ careerCode: selected.occupation_code, id: item.skill_id }); setNavigationError(""); }} />
                    {wefById.get(item.skill_id)?.core_skill}
                  </label>
                ))}
                {!availableSkills.length && <p role="status">{wefError || "No supported learning skill is available for this direction yet. Your direction stays saved."}</p>}
              </fieldset>
              {navigationError && <p role="alert" className="mt-3">{navigationError}</p>}
              <button className="px-primary mt-4" type="button" disabled={!selectedSkill || continuing} onClick={() => { void goLearning(); }}>
                {continuing ? "Saving your choice…" : selectedSkill ? `Continue with ${selectedSkill.name}` : "Choose a skill to continue"}
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

      <p className="px-chosen-hint">Career connections use broad WEF skill links from occupation and task wording. Accepted connections use your current skill review. Specialist skills, qualifications and experience have not been assessed. These suggestions do not indicate job readiness or hiring probability.</p>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import BotPet from "@/components/common/BotPet";
import PageHeader from "@/components/common/PageHeader";
import { useBotPetGreeting } from "@/hooks/useBotPetGreeting";
import { possibilitiesService } from "@/services/possibilitiesService";
import { referenceService } from "@/services/referenceService";
import { accountStorage, flushWorkspace } from "@/services/accountStorage";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import SkillOutlookSummary from "@/pages/Skills/components/SkillOutlookSummary";
import { useLearningSkills } from "@/pages/Skills/useLearningSkills";
import {
  readConfirmedAnalysis,
  readTaskWorkspace,
} from "@/pages/WorkProfile/userProfile";
import type { WefSkill } from "@/types/reference";
import {
  loadSavedPossibilities,
  possibilitiesProfilePath,
  toPossibilitiesData,
  type PossibilitiesData,
} from "./possibilitiesModel";
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

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="px-progress" aria-label={`${label}: ${pct}%`}>
      <div className="px-progress-meta">
        <strong>{pct}%</strong>
        <span>{label}</span>
      </div>
      <div className="px-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Outlook card + add to Learning Resources — same pattern as AI Impact. */
function BuildSkillChip({
  skill,
  added,
  onChanged,
  onAddedToLearning,
}: {
  skill: WefSkill;
  added: boolean;
  onChanged: () => void;
  onAddedToLearning?: () => void;
}) {
  const actionsRef = useRef<Popover.Root.Actions | null>(null);

  return (
    <Popover.Root actionsRef={actionsRef}>
      <Popover.Trigger
        nativeButton
        type="button"
        className={`px-chip missing${added ? " is-learning" : ""}`}
        aria-haspopup="dialog"
        title={
          added
            ? "View outlook · already in Learning Resources"
            : "View outlook · add to Learning Resources"
        }
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
              showAddToLearning
              onAddComplete={() => {
                onChanged();
                onAddedToLearning?.();
                actionsRef.current?.close();
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function JourneyCompanion({
  currentTitle,
  targetTitle,
  progress,
  coverageLabel,
  onExplore,
}: {
  currentTitle: string;
  targetTitle: string | null;
  progress: number;
  coverageLabel: string;
  onExplore: () => void;
}) {
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
          <ProgressBar value={progress} label="Path progress" />
          <div className="px-companion-story">
            <h3>What this path suggests</h3>
            <p>
              Your confirmed tasks already overlap with skills used in{" "}
              <strong>{targetTitle}</strong>. Coverage here is exploratory — it
              shows shared skill signals, not hiring readiness.
            </p>
            <ul>
              <li>
                <strong>{coverageLabel}</strong> of the destination skill set
                already appears in your work profile.
              </li>
              <li>
                When you are ready, open Learning Resources to turn a gap into a
                small next step.
              </li>
            </ul>
          </div>
          <button className="px-primary px-companion-cta" type="button" onClick={onExplore}>
            Explore learning resources
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
  const analysis = readConfirmedAnalysis();
  const [data, setData] = useState<PossibilitiesData | null>(null);
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(
    () => readJson<{ occupation_code?: string } | null>(DIRECTION_KEY, null)?.occupation_code ?? null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const {
    speech: petSpeech,
    say: sayPet,
    dismiss: dismissPet,
    nudge: nudgePet,
  } = useBotPetGreeting("possibilities", { ready: !loading });

  useEffect(() => {
    let cancelled = false;
    void referenceService
      .wefSkills()
      .then((rows) => {
        if (!cancelled) {
          setWefSkills(
            [...rows].sort(
              (left, right) => left.wef_skill_id - right.wef_skill_id,
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setWefSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reflectedSkills = useMemo(
    () => buildSkillEvidence(analysis?.tasks ?? [], wefSkills),
    [analysis?.tasks, wefSkills],
  );
  const reflectedSkillIds = useMemo(
    () => new Set(reflectedSkills.map(({ skill }) => skill.wef_skill_id)),
    [reflectedSkills],
  );
  const wefById = useMemo(
    () => new Map(wefSkills.map(skill => [skill.wef_skill_id, skill])),
    [wefSkills],
  );
  const { isAdded, refresh: refreshLearningSkills } = useLearningSkills();

  useEffect(() => {
    const controller = new AbortController();
    void loadSavedPossibilities({
      signal: controller.signal,
      flush: flushWorkspace,
      get: possibilitiesService.getPossibilities,
      onSuccess: r => {
        setData(toPossibilitiesData(r));
        setError("");
        setLoading(false);
        setSelectedCode(current => {
          const candidate = current ?? r.chosen_direction_code;
          return r.directions.some(direction => direction.occupation_code === candidate)
            ? candidate
            : null;
        });
      },
      onError: err => {
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
    setSelectedCode(code);
    const direction = data?.directions.find(item => item.occupation_code === code);
    if (direction) {
      accountStorage.setItem(
        DIRECTION_KEY,
        JSON.stringify({ occupation_code: code, title: direction.title }),
      );
    }
  };

  if (loading) {
    return (
      <div className="px-page">
        <p role="status">Loading possibilities…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="px-page">
        <p role="alert">{error || "Possibilities are unavailable."}</p>
        <Link to={profilePath}>Review your work profile</Link>
      </div>
    );
  }
  if (data.status === "needs_profile") {
    return (
      <div className="px-page">
        <PageHeader title="Possibilities" description="Explore directions based on your work profile." />
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
        <p role="alert">Possibilities are temporarily unavailable. Please try again later.</p>
      </div>
    );
  }

  const selected = data.directions.find(item => item.occupation_code === selectedCode);
  const currentTitle = data.currentRole?.title ?? "Your current role";
  const pathProgress =
    selected == null
      ? 0
      : selected.occupation_code === data.chosenDirectionCode && data.chosenDirectionCoverage !== null
        ? Math.round(data.chosenDirectionCoverage)
        : selected.coverage_pct ?? 0;
  const goLearning = () => {
    if (!selected) return;
    navigate(`/learning-centre?q=${encodeURIComponent(selected.title)}`);
  };

  return (
    <div className="px-page">
      <PageHeader
        title="Possibilities"
        description="Grow in your current role, or explore where your experience could take you next."
      />
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
              <ProgressBar value={data.currentRoleCoverage ?? 0} label="Current role coverage" />
            </div>
            <div className="px-current-skills">
              <h3>Skills in your profile</h3>
              <p className="px-chosen-hint">
                Same skills marked as Reflected in your tasks on AI Impact.
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
                    No reflected skills yet. Confirm tasks in your Work Profile
                    to see them here.
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
                const coverage =
                  chosen &&
                  direction.occupation_code === data.chosenDirectionCode &&
                  data.chosenDirectionCoverage !== null
                    ? Math.round(data.chosenDirectionCoverage)
                    : direction.coverage_pct ?? 0;
                return (
                  <article
                    className={`px-direction-card px-accent-${index} ${chosen ? "is-chosen" : ""}`}
                    key={direction.occupation_code}
                  >
                    {direction.area ? <p className="px-eyebrow">{direction.area}</p> : null}
                    <h3>{direction.title}</h3>
                    <div className="px-card-score">
                      <strong>
                        {coverage}
                        <small>%</small>
                      </strong>
                      <span>SKILL OVERLAP</span>
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
                  ? `${selected.area} · exploratory skill overlap from your confirmed work profile.`
                  : "Exploratory skill overlap from your confirmed work profile and ILO task evidence."}
              </p>
              {selected.description ? (
                <p className="px-chosen-copy">{selected.description}</p>
              ) : null}
              {selected.skills.length > 0 ? (
                <div className="px-chosen-skills">
                  <div className="px-skill-split">
                    <div>
                      <h3>Skills you bring</h3>
                      <div className="px-chips px-chips--path">
                        {selected.skills
                          .filter(skill => reflectedSkillIds.has(skill.skill_id))
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
                        <p className="px-chosen-hint">No overlapping skills yet for this direction.</p>
                      ) : null}
                    </div>
                    <div>
                      <h3>Skills to build</h3>
                      <p className="px-chosen-hint">
                        Open a skill to see its outlook and add it to Learning Resources.
                      </p>
                      <div className="px-chips px-chips--path">
                        {selected.skills
                          .filter(skill => !reflectedSkillIds.has(skill.skill_id))
                          .map(skill => {
                            const wef = wefById.get(skill.skill_id);
                            if (!wef) {
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
                                added={isAdded(wef.core_skill)}
                                onChanged={refreshLearningSkills}
                                onAddedToLearning={() => sayPet("add-skill-chip")}
                              />
                            );
                          })}
                      </div>
                      {selected.skills.every(skill =>
                        reflectedSkillIds.has(skill.skill_id),
                      ) ? (
                        <p className="px-chosen-hint">You already cover the skills mapped for this direction.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <button className="px-primary" type="button" onClick={goLearning}>
                Explore learning resources
              </button>
            </section>
          ) : null}
        </div>

        <JourneyCompanion
          currentTitle={currentTitle}
          targetTitle={selected?.title ?? null}
          progress={pathProgress}
          coverageLabel={`${pathProgress}%`}
          onExplore={goLearning}
        />
      </div>

      <BotPet
        storageKey="aiwrevolusi.botPetPosition.possibilities.v4"
        defaultCorner="top-right"
        speech={petSpeech}
        onSpeechDismiss={dismissPet}
        onPetTap={nudgePet}
      />
    </div>
  );
}

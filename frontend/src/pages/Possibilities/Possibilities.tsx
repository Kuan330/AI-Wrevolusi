import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { possibilitiesService } from "@/services/possibilitiesService";
import { accountStorage, flushWorkspace } from "@/services/accountStorage";
import { readTaskWorkspace } from "@/pages/WorkProfile/userProfile";
import {
  loadSavedPossibilities,
  possibilitiesProfilePath,
  toPossibilitiesData,
  type PossibilitiesData,
  type PossibilitySkill,
} from "./possibilitiesModel";
import "./exploration.css";

const DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
const SHORTLIST_KEY = "aiwrevolusi.possibilities.shortlist";
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

function JourneyCompanion({
  currentTitle,
  targetTitle,
  progress,
  skills,
  shortlist,
  onExplore,
}: {
  currentTitle: string;
  targetTitle: string | null;
  progress: number;
  skills: PossibilitySkill[];
  shortlist: number[];
  onExplore: () => void;
}) {
  const previewSkills = skills.slice(0, 4);
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
          {previewSkills.length > 0 && (
            <div className="px-companion-skills">
              <h3>Skills on this path</h3>
              <div className="px-chips">
                {previewSkills.map(skill => {
                  const planned = shortlist.includes(skill.skill_id);
                  const state = planned ? "planned" : skill.state;
                  return (
                    <span className={`px-chip ${state}`} key={skill.skill_id}>
                      {skill.name}
                      {state === "have" || state === "learning" ? (
                        <Check size={13} aria-hidden />
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <button className="px-primary px-companion-cta" type="button" onClick={onExplore}>
            Explore learning resources <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <p className="px-companion-empty">
          Choose a direction below to see your path progress with your companion.
        </p>
      )}
    </aside>
  );
}

export default function Possibilities() {
  const navigate = useNavigate();
  const profilePath = possibilitiesProfilePath(readTaskWorkspace());
  const [data, setData] = useState<PossibilitiesData | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(
    () => readJson<{ occupation_code?: string } | null>(DIRECTION_KEY, null)?.occupation_code ?? null,
  );
  const [shortlist, setShortlist] = useState<number[]>(() => readJson<number[]>(SHORTLIST_KEY, []));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
        setShortlist(
          r.shortlisted_skill_ids
            .filter(id => r.skills.some(skill => skill.skill_id === id))
            .slice(0, 60),
        );
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

  const saveShortlist = (ids: number[]) => {
    setShortlist(ids);
    accountStorage.setItem(SHORTLIST_KEY, JSON.stringify(ids));
  };

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

  const toggle = (id: number) => {
    const added = shortlist.includes(id);
    saveShortlist(added ? shortlist.filter(value => value !== id) : [...shortlist, id]);
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
  const skillName = (id: number) => data.skills.find(skill => skill.skill_id === id)?.name ?? String(id);
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
              <p className="px-eyebrow">01 · YOUR STARTING POINT</p>
              <h2>{currentTitle}</h2>
              <p>These connections come from your confirmed Work Profile.</p>
              <Link to={profilePath}>
                Review work profile <ArrowRight size={14} />
              </Link>
              <ProgressBar value={data.currentRoleCoverage ?? 0} label="Current role coverage" />
            </div>
            <div className="px-current-skills">
              <h3>Skills in your profile</h3>
              <div className="px-chips">
                {data.skills
                  .filter(s => s.state === "have")
                  .map(s => (
                    <span className="px-chip have" key={s.skill_id}>
                      {s.name}
                    </span>
                  ))}
              </div>
            </div>
          </section>

          <section className="px-options">
            <p className="px-eyebrow">02 · EXPLORE OTHER DIRECTIONS</p>
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
                      <span>SKILL COVERAGE</span>
                    </div>
                    <p className="px-direction-description">{direction.description}</p>
                    <button
                      className={chosen ? "px-primary" : "px-outline"}
                      type="button"
                      onClick={() => choose(direction.occupation_code)}
                    >
                      {chosen ? "Chosen direction" : "Explore this direction"}
                      <ArrowRight size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {selected && (
            <section className="px-journey">
              <p className="px-eyebrow">03 · MY CHOSEN DIRECTION</p>
              <h2>Your path to {selected.title}</h2>
              <p>{selected.description}</p>
              <h3>Skills to explore next</h3>
              <div className="px-chips">
                {selected.skills.map(skill => {
                  const added = shortlist.includes(skill.skill_id);
                  return (
                    <button
                      className={`px-chip ${added ? "planned" : skill.state}`}
                      key={skill.skill_id}
                      type="button"
                      onClick={() => toggle(skill.skill_id)}
                    >
                      {skillName(skill.skill_id)}
                      {added ? (
                        <X size={13} aria-hidden />
                      ) : skill.state === "missing" ? (
                        <Plus size={13} aria-hidden />
                      ) : (
                        <Check size={13} aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="px-next-step">
                <p>Browse verified courses for these skills in Learning Resources.</p>
                <button className="px-primary" type="button" onClick={goLearning}>
                  Explore learning resources <ArrowRight size={16} />
                </button>
              </div>
            </section>
          )}
        </div>

        <JourneyCompanion
          currentTitle={currentTitle}
          targetTitle={selected?.title ?? null}
          progress={pathProgress}
          skills={selected?.skills ?? []}
          shortlist={shortlist}
          onExplore={goLearning}
        />
      </div>
    </div>
  );
}

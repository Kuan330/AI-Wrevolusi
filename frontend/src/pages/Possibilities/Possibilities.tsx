import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Info, Plus } from "lucide-react";

import BotPet from "@/components/common/BotPet";
import PageHeader from "@/components/common/PageHeader";
import { useBotPetGreeting } from "@/hooks/useBotPetGreeting";
import { readTaskWorkspace } from "@/pages/WorkProfile/userProfile";
import { accountStorage, flushWorkspace } from "@/services/accountStorage";
import { possibilitiesService } from "@/services/possibilitiesService";

import {
  loadSavedPossibilities,
  possibilitiesProfilePath,
  toPossibilitiesData,
  type PossibilitiesData,
  type PossibilityDirection,
} from "./possibilitiesModel";
import "./exploration.css";

const DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
const SHORTLIST_KEY = "aiwrevolusi.possibilities.shortlist";

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = accountStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

function directionReason(direction: PossibilityDirection): string {
  const owned = direction.skills.filter((skill) => skill.state === "have");
  if (owned.length >= 2) {
    return `Strong match in ${owned[0].name.toLowerCase()} and ${owned[1].name.toLowerCase()}.`;
  }
  if (owned.length === 1) {
    return `Builds on your ${owned[0].name.toLowerCase()} skill.`;
  }
  return "A direction you can explore by building new skills.";
}

export default function Possibilities() {
  const navigate = useNavigate();
  const profilePath = possibilitiesProfilePath(readTaskWorkspace());
  const savedDirection = readJson<{ occupation_code?: string } | null>(
    DIRECTION_KEY,
    null,
  )?.occupation_code;
  const [data, setData] = useState<PossibilitiesData | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(
    savedDirection ?? null,
  );
  const [chosenCode, setChosenCode] = useState<string | null>(
    savedDirection ?? null,
  );
  const [shortlist, setShortlist] = useState<number[]>(() =>
    readJson<number[]>(SHORTLIST_KEY, []),
  );
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

  useEffect(() => {
    const controller = new AbortController();
    void loadSavedPossibilities({
      signal: controller.signal,
      flush: flushWorkspace,
      get: possibilitiesService.getPossibilities,
      onSuccess: (response) => {
        const mapped = toPossibilitiesData(response);
        const alternatives = mapped.directions.filter(
          (direction) =>
            direction.occupation_code !== mapped.currentRole?.occupation_code,
        );
        const serverChoice = alternatives.some(
          (direction) =>
            direction.occupation_code === response.chosen_direction_code,
        )
          ? response.chosen_direction_code
          : null;

        setData(mapped);
        setError("");
        setLoading(false);
        setSelectedCode((current) =>
          alternatives.some(
            (direction) => direction.occupation_code === current,
          )
            ? current
            : (serverChoice ?? alternatives[0]?.occupation_code ?? null),
        );
        setChosenCode(serverChoice);
        setShortlist(
          response.shortlisted_skill_ids
            .filter((id) => response.skills.some((skill) => skill.skill_id === id))
            .slice(0, 60),
        );
      },
      onError: (loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not save your work profile or load career exploration. Please try again.",
        );
        setLoading(false);
      },
    });
    return () => controller.abort();
  }, []);

  const choose = (direction: PossibilityDirection) => {
    setChosenCode(direction.occupation_code);
    accountStorage.setItem(
      DIRECTION_KEY,
      JSON.stringify({
        occupation_code: direction.occupation_code,
        title: direction.title,
      }),
    );
  };

  const toggleSkill = (id: number) => {
    const added = shortlist.includes(id);
    const next = added
      ? shortlist.filter((value) => value !== id)
      : [...shortlist, id];
    setShortlist(next);
    accountStorage.setItem(SHORTLIST_KEY, JSON.stringify(next));
    if (!added) sayPet("add-skill-chip");
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
        <PageHeader
          className="px-page-header"
          title="Possibilities"
          description="Explore directions based on your work profile."
        />
        <section className="px-empty-state">
          <h2>Complete your Work Profile</h2>
          <p>
            Confirm your current role and tasks first so we can show relevant
            directions.
          </p>
          <Link className="px-primary" to={profilePath}>
            Go to Work Profile <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    );
  }

  if (data.status === "unavailable") {
    return (
      <div className="px-page">
        <p role="alert">
          Possibilities are temporarily unavailable. Please try again later.
        </p>
      </div>
    );
  }

  const ownedProfileSkills = data.skills.filter((skill) => skill.state === "have");
  const directions = data.directions.filter(
    (direction) =>
      direction.occupation_code !== data.currentRole?.occupation_code,
  );

  return (
    <div className="px-page">
      <PageHeader
        className="px-page-header"
        title="Possibilities"
        description="Explore where your skills could take you."
      />

      <section className="px-current" aria-label="Current role">
        <div className="px-current-copy">
          <p>
            Current role <span aria-hidden="true">·</span>{" "}
            <strong>{data.currentRole?.title ?? "Your current role"}</strong>
          </p>
          <div className="px-chips" aria-label="Skills reflected in your work">
            {ownedProfileSkills.map((skill) => (
              <span className="px-chip have" key={skill.skill_id}>
                {skill.name}
              </span>
            ))}
          </div>
        </div>
        <Link to={profilePath}>
          Review profile <ArrowRight size={17} />
        </Link>
      </section>

      <section className="px-directions" aria-labelledby="directions-title">
        <h2 id="directions-title">Explore directions</h2>
        {directions.length > 0 ? (
          <div className="px-direction-list">
            {directions.map((direction) => {
              const expanded = direction.occupation_code === selectedCode;
              const ownedSkills = direction.skills.filter(
                (skill) => skill.state === "have",
              );
              const growthSkills = direction.skills.filter(
                (skill) => skill.state !== "have",
              );
              const selectedLearningSkill =
                growthSkills.find((skill) => shortlist.includes(skill.skill_id)) ??
                growthSkills[0];

              return (
                <article
                  className={`px-direction ${expanded ? "is-expanded" : ""}`}
                  key={direction.occupation_code}
                >
                  <button
                    type="button"
                    className="px-direction-summary"
                    aria-expanded={expanded}
                    onClick={() =>
                      setSelectedCode(expanded ? null : direction.occupation_code)
                    }
                  >
                    <h3>{direction.title}</h3>
                    <div className="px-score">
                      <strong>
                        {direction.coverage_pct === null
                          ? "—"
                          : `${direction.coverage_pct}%`}
                      </strong>
                      <span>skill overlap</span>
                    </div>
                    <p>{directionReason(direction)}</p>
                    <ChevronDown size={22} aria-hidden="true" />
                  </button>

                  {expanded && (
                    <div className="px-direction-detail">
                      <section>
                        <h4>Skills you bring</h4>
                        <div className="px-chips">
                          {ownedSkills.length > 0 ? (
                            ownedSkills.map((skill) => (
                              <span className="px-chip have" key={skill.skill_id}>
                                {skill.name}
                              </span>
                            ))
                          ) : (
                            <p>No shared skills were detected yet.</p>
                          )}
                        </div>
                      </section>

                      <section>
                        <h4>Skills to build</h4>
                        {growthSkills.length > 0 ? (
                          <div className="px-chips">
                            {growthSkills.map((skill) => {
                              const added = shortlist.includes(skill.skill_id);
                              return (
                                <button
                                  type="button"
                                  className={`px-chip ${added ? "planned" : "missing"}`}
                                  aria-pressed={added}
                                  key={skill.skill_id}
                                  onClick={() => toggleSkill(skill.skill_id)}
                                >
                                  {skill.name}
                                  {added ? <Check size={14} /> : <Plus size={14} />}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p>No additional skill gaps were detected.</p>
                        )}

                        <div className="px-detail-actions">
                          <button
                            type="button"
                            className="px-primary"
                            aria-pressed={chosenCode === direction.occupation_code}
                            onClick={() => choose(direction)}
                          >
                            {chosenCode === direction.occupation_code ? (
                              <>
                                <Check size={17} /> Direction chosen
                              </>
                            ) : (
                              "Choose this direction"
                            )}
                          </button>
                          {selectedLearningSkill && (
                            <button
                              type="button"
                              className="px-text-action"
                              onClick={() =>
                                navigate(
                                  `/learning-centre?q=${encodeURIComponent(selectedLearningSkill.name)}`,
                                )
                              }
                            >
                              Find courses for these skills <ArrowRight size={16} />
                            </button>
                          )}
                        </div>
                      </section>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-empty-state">
            <h2>No alternative directions yet</h2>
            <p>
              Add more detail to your confirmed tasks so we can find useful
              connections.
            </p>
          </div>
        )}
      </section>

      <p className="px-disclaimer">
        <Info size={17} /> {data.disclaimer}
      </p>

      <BotPet
        placement="inline"
        storageKey="aiwrevolusi.botPetPosition.possibilities.v1"
        speech={petSpeech}
        onSpeechDismiss={dismissPet}
        onPetTap={nudgePet}
      />
    </div>
  );
}

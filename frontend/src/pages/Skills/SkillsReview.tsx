import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import {
  completeSkillReview,
  currentWorkKey,
  isSkillReviewCurrent,
  readJourneyState,
  saveSkillDecision,
  startLearning,
} from "@/features/journey/journey";
import type { ProfileTask } from "@/features/work-profile/types";
import { readUserProfile } from "@/features/work-profile/userProfile";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import { skillKey } from "./learningSkills";
import { buildSkillEvidence } from "./lib/skillProfile";
import "./SkillsReview.css";

type Decision = "accepted" | "rejected" | undefined;
type WorkSnapshot = {
  tasks: ProfileTask[];
  workKey: string;
  needsReview: boolean;
  reviewComplete: boolean;
  decisions: Record<number, Decision>;
};

function readWorkSnapshot(): { work: WorkSnapshot | null; error: string } {
  try {
    const journey = readJourneyState();
    const workKey = currentWorkKey();
    return {
      work: {
        tasks: readUserProfile().tasks,
        workKey,
        needsReview: Boolean(journey.review && journey.review.workKey !== workKey),
        reviewComplete: isSkillReviewCurrent(),
        decisions: journey.review?.decisions ?? {},
      },
      error: "",
    };
  } catch (error) {
    return { work: null, error: error instanceof Error ? error.message : "Your saved skill review could not be read." };
  }
}

export default function SkillsReview() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<WefSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState(readWorkSnapshot);
  const { work, error: readError } = snapshot;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const retrySave = useRef<(() => Promise<void>) | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshWork = useCallback(() => {
    setSnapshot(readWorkSnapshot());
  }, []);

  useEffect(() => {
    window.addEventListener("workspace-change", refreshWork);
    return () => window.removeEventListener("workspace-change", refreshWork);
  }, [refreshWork]);

  useEffect(() => {
    let cancelled = false;
    void referenceService.wefSkills().then((rows) => {
      if (!cancelled) setSkills(rows);
    }).catch(() => {
      if (!cancelled) setLoadError("The skill reference could not be loaded. Please try again.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  const evidence = useMemo(() => buildSkillEvidence(work?.tasks ?? [], skills), [work?.tasks, skills]);
  const accepted = evidence.filter(({ skill }) =>
    !work?.needsReview && work?.decisions[skill.wef_skill_id] === "accepted",
  );
  const selected = accepted.find(({ skill }) => skill.wef_skill_id === selectedId);
  const disabled = saving || Boolean(readError) || loading || Boolean(loadError);

  async function runSave(action: () => Promise<void>) {
    if (saving || readError) return;
    retrySave.current = action;
    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      await action();
      if (mounted.current) {
        retrySave.current = null;
        setSaveMessage("Your changes are saved.");
      }
    } catch (error) {
      if (mounted.current) setSaveError(error instanceof Error ? error.message : "Your changes could not be saved.");
    } finally {
      if (mounted.current) {
        setSaving(false);
        refreshWork();
      }
    }
  }

  function checkWork() {
    if (!work || currentWorkKey() !== work.workKey) {
      throw new Error("Your work changed. Review the updated suggestions before continuing.");
    }
  }

  function decide(id: number, decision: Decision) {
    void runSave(async () => {
      checkWork();
      await saveSkillDecision(id, decision);
      if (decision !== "accepted" && selectedId === id) setSelectedId(null);
    });
  }

  function finishReview() {
    void runSave(async () => {
      checkWork();
      await completeSkillReview();
    });
  }

  function continueToLearning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !goal.trim()) return;
    const { skill, tasks } = selected;
    void runSave(async () => {
      checkWork();
      await completeSkillReview();
      const destination = await startLearning({
        origin: "work",
        skill: { id: skill.wef_skill_id, slug: skillKey(skill.core_skill), name: skill.core_skill },
        taskIds: tasks.map((task) => task.id),
        taskLabels: tasks.map((task) => task.wording),
        goal: goal.trim(),
      });
      if (mounted.current) navigate(destination);
    });
  }

  return (
    <div className="skills-review-page mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="Review my skills"
        description="Check the suggestions from your confirmed work, then choose one skill to develop."
        actions={<Button asChild variant="outline" className="rounded-full"><Link to={ROUTES.task}>Edit my tasks</Link></Button>}
      />
      <p className="skills-review-page__intro">
        These suggestions use the broad WEF skill framework and words in your tasks. A connection needs your review;
        it does not measure your ability or mean you need improvement. AI-impact scores do not decide which skills appear here.
      </p>

      {readError && <div className="skills-review-page__notice is-error" role="alert">
        <p>{readError} Your saved review has not been replaced. Reload your saved work before making changes.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload saved work</Button>
      </div>}
      {work?.needsReview && <div className="skills-review-page__notice" role="status">
        Your work has changed. Check earlier accepted skills again using the current task wording. Rejected suggestions
        remain rejected, and saved learning stays available.
      </div>}
      {saveError && <div className="skills-review-page__notice is-error" role="alert">
        <p>{saveError} These changes are not confirmed saved.</p>
        <Button variant="outline" disabled={saving || Boolean(readError)} onClick={() => {
          const retry = retrySave.current;
          if (retry) void runSave(retry);
        }}>Retry save</Button>
      </div>}
      <p className="skills-review-page__save-status" role="status" aria-live="polite">
        {saving ? "Saving your changes…" : saveMessage}
      </p>

      {readError ? null : loading ? <p role="status">Loading skill suggestions…</p> : loadError ? <div className="skills-review-page__notice is-error" role="alert">
        <p>{loadError}</p><Button variant="outline" onClick={() => {
          setLoading(true); setLoadError(""); setLoadAttempt((value) => value + 1);
        }}>Try again</Button>
      </div> : !work?.tasks.length ? <section className="skills-review-page__card">
        <h2>Start with your confirmed work</h2>
        <p>Confirm at least one task before reviewing skill suggestions.</p>
        <Button asChild><Link to={ROUTES.task}>Review my tasks</Link></Button>
      </section> : <>
        <section aria-labelledby="skill-suggestions-title">
          <div className="skills-review-page__section-heading">
            <h2 id="skill-suggestions-title">Skills suggested from your tasks</h2>
            <p>{accepted.length} accepted · {evidence.length} suggestions</p>
          </div>
          {evidence.length === 0 ? <div className="skills-review-page__card">
            <h3>No supported suggestion yet</h3>
            <p>The current matching rules found no skill connection in these tasks. This does not mean you have no skills.
              You can make the task wording clearer or browse learning on your own.</p>
          </div> : <div className="skills-review-page__grid">
            {evidence.map(({ skill, tasks }) => {
              const decision = work.decisions[skill.wef_skill_id];
              const staleAccepted = work.needsReview && decision === "accepted";
              const status = staleAccepted ? "Needs review" : decision === "accepted" ? "Accepted" : decision === "rejected" ? "Rejected" : "Not reviewed";
              return <article className="skills-review-page__card" key={skill.wef_skill_id}>
                <div className="skills-review-page__skill-heading">
                  <h3>{skill.core_skill}</h3>
                  <span className={`skills-review-page__state${decision && !staleAccepted ? ` is-${decision}` : ""}`}>{status}</span>
                </div>
                <p className="skills-review-page__source">WEF skill framework · Suggested from task wording</p>
                <p className="skills-review-page__evidence-label">Your supporting task{tasks.length === 1 ? "" : "s"}</p>
                <ul className="skills-review-page__tasks">{tasks.map((task) => <li key={task.id}>{task.wording}</li>)}</ul>
                <div className="skills-review-page__decisions" aria-label={`Review ${skill.core_skill}`}>
                  <Button variant={decision === "accepted" && !staleAccepted ? "default" : "outline"}
                    disabled={disabled} aria-pressed={decision === "accepted" && !staleAccepted}
                    onClick={() => decide(skill.wef_skill_id, "accepted")}>This fits my work</Button>
                  <Button variant="outline" disabled={disabled} aria-pressed={decision === "rejected"}
                    onClick={() => decide(skill.wef_skill_id, "rejected")}>This does not fit</Button>
                  {decision && <Button variant="ghost" disabled={disabled} onClick={() => decide(skill.wef_skill_id, undefined)}>Undo decision</Button>}
                </div>
              </article>;
            })}
          </div>}
        </section>

        <section className="skills-review-page__card skills-review-page__next" aria-labelledby="skill-next-title">
          <h2 id="skill-next-title">Choose one next learning step</h2>
          {accepted.length > 0 ? <form onSubmit={continueToLearning}>
            <label htmlFor="review-learning-skill">Which accepted skill would you like to develop?</label>
            <select id="review-learning-skill" value={selected?.skill.wef_skill_id ?? ""} required disabled={disabled}
              onChange={(event) => { setSelectedId(Number(event.target.value) || null); setSaveError(""); retrySave.current = null; }}>
              <option value="">Choose a skill</option>
              {accepted.map(({ skill }) => <option key={skill.wef_skill_id} value={skill.wef_skill_id}>{skill.core_skill}</option>)}
            </select>
            <label htmlFor="review-learning-goal">What would you like to learn to do?</label>
            <textarea id="review-learning-goal" value={goal} maxLength={240} rows={3} required disabled={disabled}
              placeholder="For example, explain the findings in my weekly report more clearly."
              onChange={(event) => { setGoal(event.target.value); setSaveError(""); retrySave.current = null; }} />
            <p className="skills-review-page__hint">Your confirmed task and this goal will stay with your learning choice.</p>
            <Button type="submit" disabled={disabled || !selected || !goal.trim()}>Continue to learning</Button>
          </form> : <p>Accept a suggestion that fits your work to use it for a current-work learning recommendation.
            You can finish this review with no accepted skills and explore learning on your own.</p>}
          <div className="skills-review-page__finish">
            <Button variant="outline" disabled={disabled} onClick={finishReview}>Save review for now</Button>
            {work.reviewComplete && <Link to={`${ROUTES.learningCentre}?mode=browse`}>Browse learning on my own</Link>}
          </div>
          <p className="skills-review-page__hint">You can leave suggestions undecided and return later. Independent learning is your own choice.</p>
        </section>
      </>}
    </div>
  );
}

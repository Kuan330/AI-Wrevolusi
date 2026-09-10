import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AppButton } from "@/components/ui/app-button";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/radio";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/services/api";
import type { RecommendationBasis as Basis } from "../types";
export type RecommendationBasisProps = {
  skillName: string;
  value: Basis;
  onSave: (basis: Basis) => boolean | Promise<boolean>;
};
const levels = [
  { id: "starting", label: "Just starting" },
  { id: "supported", label: "With support" },
  { id: "independent", label: "Independent" },
  { id: "advanced", label: "Advanced" },
] as const;
export default function RecommendationBasis(props: RecommendationBasisProps) {
  const { skillName, value, onSave } = props;
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(value),
    [saving, setSaving] = useState(false),
    [generating, setGenerating] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [suggestion, setSuggestion] = useState("");
  const requestId = useRef(0);
  function close(next: boolean) {
    if (saving) return;
    requestId.current++;
    setGenerating(false);
    setOpen(next);
    if (next) {
      setDraft(value);
      setError("");
      setStale(false);
      setSuggestion("");
    }
  }
  function update(next: Basis) {
    requestId.current++;
    setGenerating(false);
    setDraft(next);
    setSuggestion("");
    setStale(!!draft.goals);
  }
  async function generate() {
    if (!draft.level) return;
    const id = ++requestId.current;
    setGenerating(true);
    setError("");
    try {
      const result = await api.post<{ goal: string }>(
        "/skill-directions/learning-goal",
        {
          skill: skillName,
          level: draft.level,
          tasks: draft.tasks,
          abilities: draft.have,
        },
        90000,
      );
      if (id !== requestId.current) return;
      if (!result.goal?.trim())
        throw new Error("No goal returned. Please try again.");
      setSuggestion(result.goal);
    } catch (error) {
      if (id === requestId.current)
        setError(
          error instanceof Error ? error.message : "Could not suggest a goal.",
        );
    } finally {
      if (id === requestId.current) setGenerating(false);
    }
  }
  return (
    <section className="library-basis library-glass">
      <Dialog open={open} onOpenChange={close}>
        <div className="library-row">
          <div>
            <p className="library-kicker">Your learning focus</p>
            <h3>{skillName}</h3>
          </div>
          <DialogTrigger asChild>
            <AppButton tone="brand">
              {value.level ? "Adjust" : "Set starting point"}
            </AppButton>
          </DialogTrigger>
        </div>
        <div className="learning-focus-summary">
          <div>
            <small>Current foundation</small>
            <p>
              {levels.find((level) => level.id === value.level)?.label ??
                "Not confirmed yet"}
            </p>
          </div>
          <span className="learning-focus-arrow" aria-hidden="true"><ArrowRight size={22} strokeWidth={1.8} /></span>
          <div>
            <small>Next learning goal</small>
            <p>
              {value.goals ||
                "Confirm your starting point to set a suitable goal."}
            </p>
          </div>
        </div>
        <DialogContent className="learning-focus-dialog">
          <DialogHeader>
            <DialogTitle>Adjust your learning starting point</DialogTitle>
            <DialogDescription>
              {skillName} · Confirm your foundation, then choose a practical
              goal.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!draft.level || !draft.goals.trim()) return;
              setSaving(true);
              setError("");
              try {
                if (await onSave({ ...draft, goals: draft.goals.trim() }))
                  setOpen(false);
                else setError("Could not save changes. Please try again.");
              } catch {
                setError("Could not save changes. Please try again.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="learning-focus-body">
              <fieldset disabled={saving}>
                <legend>Your current foundation</legend>
                <div className="learning-foundation-options">
                  {levels.map((level) => (
                    <label
                      key={level.id}
                      className={draft.level === level.id ? "is-selected" : ""}
                    >
                      <Radio
                        name="learning-foundation"
                        checked={draft.level === level.id}
                        onChange={() => update({ ...draft, level: level.id })}
                      />
                      {level.label}
                    </label>
                  ))}
                </div>
                <small>
                  Your self-confirmed starting point, not an AI proficiency
                  assessment.
                </small>
              </fieldset>
              <details>
                <summary>Related work experience</summary>
                <label>
                  Relevant tasks
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={draft.tasks}
                    disabled={saving}
                    onChange={(event) =>
                      update({ ...draft, tasks: event.target.value })
                    }
                  />
                </label>
                <label>
                  What you already know
                  <textarea
                    rows={2}
                    maxLength={3000}
                    value={draft.have}
                    disabled={saving}
                    onChange={(event) =>
                      update({ ...draft, have: event.target.value })
                    }
                  />
                </label>
              </details>
              <div className="library-row">
                <label htmlFor="learning-goal">Learning goal</label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!draft.level || generating || saving}
                  onClick={generate}
                >
                  {generating ? "Suggesting…" : "AI suggest goal"}
                </Button>
              </div>
              <textarea
                id="learning-goal"
                rows={4}
                maxLength={3000}
                required
                value={draft.goals}
                disabled={saving}
                placeholder="Write a goal, or request an AI suggestion."
                onChange={(event) => {
                  setDraft({ ...draft, goals: event.target.value });
                  setStale(false);
                }}
              />
              {stale && (
                <small>
                  Your foundation or experience changed. Review your goal or
                  request a new suggestion before saving.
                </small>
              )}
              {suggestion && (
                <div className="learning-goal-suggestion">
                  <strong>Suggested goal</strong>
                  <p>{suggestion}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraft({ ...draft, goals: suggestion });
                      setSuggestion("");
                      setStale(false);
                    }}
                  >
                    Use this goal
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSuggestion("")}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
            </div>
            <div className="library-context-actions learning-focus-footer">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving || generating || !draft.level || !draft.goals.trim()
                }
              >
                {saving ? "Saving…" : "Save and update"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

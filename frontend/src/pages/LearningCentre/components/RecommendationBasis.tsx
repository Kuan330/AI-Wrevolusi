import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { RecommendationBasis as Basis } from "../types";
export type RecommendationBasisProps = {
  skillName: string;
  value: Basis;
  onSave: (basis: Basis) => boolean | Promise<boolean>;
};
export default function RecommendationBasis(props: RecommendationBasisProps) {
  const { skillName, value, onSave } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = JSON.stringify(draft) !== JSON.stringify(value);
  return (
    <section className="library-basis library-glass">
      <div className="library-row">
        <div>
          <p className="library-kicker">Your learning context</p>
          <h3>Recommendation basis</h3>
        </div>
        {!editing && (
          <Button
            className="library-edit-context"
            variant="ghost"
            onClick={() => {
              setDraft(value);
              setError("");
              setEditing(true);
            }}
          >
            Edit context
          </Button>
        )}
      </div>
      <p className="library-muted">
        Courses are matched to {skillName} using course topic associations.
        Saving your context automatically updates the practice template inside
        each course.
      </p>
      {editing ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!changed || saving) return;
            setSaving(true);
            setError("");
            try {
              if (await onSave(draft)) setEditing(false);
              else setError("Could not save your context. Please try again.");
            } catch {
              setError("Could not save your context. Please try again.");
            } finally {
              setSaving(false);
            }
          }}
          className="library-context-form"
        >
          {(
            [
              ["tasks", "Tasks I want to support"],
              ["goals", "My learning goals"],
              ["have", "What I already know"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                rows={3}
                maxLength={3000}
                value={draft[key]}
                onChange={(event) =>
                  setDraft({ ...draft, [key]: event.target.value })
                }
              />
            </label>
          ))}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="library-context-actions">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setDraft(value);
                setError("");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!changed || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="library-context-summary library-context-facts">
          <div>
            <dt>Skill</dt>
            <dd>
              <span>{skillName}</span>
            </dd>
          </div>
          {(
            [
              ["tasks", "Work tasks"],
              ["goals", "Learning goals"],
              ["have", "Abilities you confirmed"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {value[key].trim() ? (
                  value[key]
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line, index) => <span key={index}>{line}</span>)
                ) : (
                  <small>Not added yet</small>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

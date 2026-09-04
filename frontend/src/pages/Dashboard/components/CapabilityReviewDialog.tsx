import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type {
  CapabilityEvolution,
  ConfirmedCapabilityProfile,
  ConfirmedCapabilityProfileItem,
  ConfirmedTaskCapabilityRecognitionBatchResponse,
} from "@/types/capability";

type CapabilityReviewDialogProps = {
  open: boolean;
  tasks: ProfileTask[];
  recognition: ConfirmedTaskCapabilityRecognitionBatchResponse | null;
  savedProfile: ConfirmedCapabilityProfile | null;
  onClose: () => void;
  onSave: (profile: ConfirmedCapabilityProfile) => void;
};

type CapabilityDraft = ConfirmedCapabilityProfileItem & {
  selected: boolean;
  similarity: number | null;
};

const EVOLUTION_LABELS: Record<CapabilityEvolution, string> = {
  continue_to_be_useful: "Continue to be useful",
  needs_strengthening: "May need strengthening",
  needs_updating: "May need updating",
};

const createCapabilityDrafts = (
  recognition: ConfirmedTaskCapabilityRecognitionBatchResponse | null,
  savedProfile: ConfirmedCapabilityProfile | null,
): CapabilityDraft[] => {
  const savedByWefSkillId = new Map(
    (savedProfile?.capabilities ?? [])
      .filter((capability) => capability.wefSkillId !== null)
      .map((capability) => [capability.wefSkillId, capability]),
  );
  const suggestionDrafts = (recognition?.capabilities ?? []).map((capability) => {
    const saved = savedByWefSkillId.get(capability.wef_skill_id);
    return {
      id: saved?.id ?? `wef-${capability.wef_skill_id}`,
      wefSkillId: capability.wef_skill_id,
      name: saved?.name ?? capability.core_skill,
      linkedTaskIds:
        saved?.linkedTaskIds ?? capability.task_evidence.map((evidence) => evidence.task_id),
      evolution: saved?.evolution ?? capability.suggested_evolution,
      workplaceExample: saved?.workplaceExample ?? "",
      source: saved?.source ?? "model",
      modelVersion: capability.model_version,
      reasoning: capability.reasoning,
      uncertainty: capability.uncertainty,
      limitations: capability.limitations,
      selected: Boolean(saved),
      similarity: capability.strongest_similarity,
    } satisfies CapabilityDraft;
  });
  const suggestionWefIds = new Set(suggestionDrafts.map((draft) => draft.wefSkillId));
  const retainedSavedDrafts = (savedProfile?.capabilities ?? [])
    .filter(
      (capability) =>
        capability.wefSkillId === null || !suggestionWefIds.has(capability.wefSkillId),
    )
    .map(
      (capability) =>
        ({ ...capability, selected: true, similarity: null }) satisfies CapabilityDraft,
    );
  return [...suggestionDrafts, ...retainedSavedDrafts];
};

const CapabilityReviewDialog = ({
  open,
  tasks,
  recognition,
  savedProfile,
  onClose,
  onSave,
}: CapabilityReviewDialogProps) => {
  const [drafts, setDrafts] = useState<CapabilityDraft[]>(() =>
    createCapabilityDrafts(recognition, savedProfile),
  );
  const [manualName, setManualName] = useState("");
  const [manualExample, setManualExample] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const updateDraft = (id: string, patch: Partial<CapabilityDraft>) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  };

  const addManualCapability = () => {
    const name = manualName.trim();
    if (!name) {
      setFormError("Enter a capability name before adding it.");
      return;
    }
    setDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        wefSkillId: null,
        name,
        linkedTaskIds: [],
        evolution: null,
        workplaceExample: manualExample.trim(),
        source: "user",
        modelVersion: null,
        reasoning: null,
        uncertainty: null,
        limitations: null,
        selected: true,
        similarity: null,
      },
    ]);
    setManualName("");
    setManualExample("");
    setFormError(null);
  };

  const saveProfile = () => {
    const selectedDrafts = drafts.filter((draft) => draft.selected);
    if (selectedDrafts.some((draft) => !draft.name.trim())) {
      setFormError("Every confirmed capability needs a name.");
      return;
    }
    onSave({
      version: 1,
      modelVersion:
        recognition?.capabilities[0]?.model_version ?? savedProfile?.modelVersion ?? null,
      capabilities: selectedDrafts.map(
        ({ selected: _selected, similarity: _similarity, ...capability }) => ({
          ...capability,
          name: capability.name.trim(),
          workplaceExample: capability.workplaceExample.trim(),
        }),
      ),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-[24px] border border-white/80 bg-[#fffafc] p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#2f2430]">
            Review your capability profile
          </DialogTitle>
          <DialogDescription className="leading-5 text-[#574a55]">
            These are AI-assisted suggestions, not certification or a readiness score. Keep,
            rename or remove them, add your own, and record workplace evidence before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {drafts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#c9b9c5] bg-white/70 p-4 text-sm text-[#574a55]">
              No capability suggestions are available. You can still add a capability below.
            </p>
          ) : null}

          {drafts.map((draft) => (
            <section key={draft.id} className="space-y-3 rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f2430]">
                  <input
                    type="checkbox"
                    checked={draft.selected}
                    onChange={(event) => updateDraft(draft.id, { selected: event.target.checked })}
                    className="h-4 w-4 rounded border-[#9f8e9b] accent-[#4f91ba]"
                  />
                  Include in confirmed profile
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#a33f52]"
                  onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
                >
                  Remove
                </Button>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#574a55]">Capability name</span>
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
                  className="h-11 w-full rounded-xl border border-[#dbcfd8] bg-white px-3 text-sm outline-none focus:border-[#4f91ba] focus:ring-4 focus:ring-[#4f91ba]/10"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#574a55]">
                  Workplace example (optional)
                </span>
                <textarea
                  value={draft.workplaceExample}
                  onChange={(event) =>
                    updateDraft(draft.id, { workplaceExample: event.target.value })
                  }
                  rows={2}
                  placeholder="Describe when you demonstrated this capability."
                  className="w-full resize-y rounded-xl border border-[#dbcfd8] bg-white px-3 py-2 text-sm outline-none focus:border-[#4f91ba] focus:ring-4 focus:ring-[#4f91ba]/10"
                />
              </label>

              <div className="flex flex-wrap gap-2 text-xs text-[#665966]">
                <span className="rounded-full bg-[#e9f3f8] px-2.5 py-1">
                  {draft.source === "model" ? "AI-assisted suggestion" : "Added by you"}
                </span>
                {draft.similarity !== null ? (
                  <span className="rounded-full bg-[#f0eaf8] px-2.5 py-1">
                    similarity {draft.similarity.toFixed(2)}
                  </span>
                ) : null}
                {draft.evolution ? (
                  <span className="rounded-full bg-[#fff3d6] px-2.5 py-1">
                    {EVOLUTION_LABELS[draft.evolution]}
                  </span>
                ) : null}
              </div>

              {draft.linkedTaskIds.length > 0 ? (
                <div className="text-xs leading-5 text-[#665966]">
                  <p className="font-semibold">Producing tasks</p>
                  <ul className="list-disc pl-5">
                    {draft.linkedTaskIds.map((taskId) => (
                      <li key={taskId}>{taskById.get(taskId)?.wording ?? taskId}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {draft.reasoning ? (
                <details className="rounded-xl bg-[#f7f3f6] px-3 py-2 text-xs leading-5 text-[#665966]">
                  <summary className="cursor-pointer font-semibold text-[#2f2430]">
                    Why this was suggested
                  </summary>
                  <p className="mt-2">{draft.reasoning}</p>
                  <p className="mt-2"><strong>Uncertainty:</strong> {draft.uncertainty}</p>
                  <p className="mt-2"><strong>Limitation:</strong> {draft.limitations}</p>
                </details>
              ) : null}
            </section>
          ))}

          <section className="space-y-3 rounded-2xl border border-dashed border-[#b8a8b5] bg-white/55 p-4">
            <h3 className="font-semibold text-[#2f2430]">Add another capability</h3>
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Capability name"
              aria-label="New capability name"
              className="h-11 w-full rounded-xl border border-[#dbcfd8] bg-white px-3 text-sm outline-none focus:border-[#4f91ba]"
            />
            <textarea
              value={manualExample}
              onChange={(event) => setManualExample(event.target.value)}
              rows={2}
              placeholder="Workplace example (optional)"
              aria-label="New capability workplace example"
              className="w-full resize-y rounded-xl border border-[#dbcfd8] bg-white px-3 py-2 text-sm outline-none focus:border-[#4f91ba]"
            />
            <Button type="button" variant="outline" onClick={addManualCapability}>
              Add capability
            </Button>
          </section>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={saveProfile}>
            Save confirmed profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CapabilityReviewDialog;

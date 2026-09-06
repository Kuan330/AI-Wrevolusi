import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FormField,
  Input,
  FormSelect,
  Textarea,
} from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTaskId } from "@/pages/WorkProfile/taskOptions";
import type {
  ProfileTask,
  TaskBaseline,
  TaskPractice,
  TaskTrial,
  TrialQuality,
} from "@/pages/WorkProfile/types";
import { matchingBaseline, parseMinutes } from "../lib/taskPractice";

type Props = {
  task: ProfileTask;
  baselineTrial?: TaskTrial;
  onClose: () => void;
  onSave: (update: (current: TaskPractice) => TaskPractice) => void;
};
export default function TrialDialog({
  task,
  baselineTrial,
  onClose,
  onSave,
}: Props) {
  const baseline = task.practice?.baseline;
  const latest = task.practice?.trials.find(
    (trial) => trial.taskWording === task.wording,
  );
  const initialWorkload =
    baselineTrial?.workload ??
    latest?.workload ??
    (baseline?.taskWording === task.wording ? baseline.workload : "");
  const initialMinutes = baselineTrial
    ? baselineTrial.baselineMinutes
    : matchingBaseline(baseline, task.wording, initialWorkload);
  const [workload, setWorkload] = useState(initialWorkload);
  const [minutes, setMinutes] = useState("");
  const [baselineMinutes, setBaselineMinutes] = useState(
    initialMinutes == null ? "" : String(initialMinutes),
  );
  const [comparable, setComparable] = useState(
    Boolean(baselineTrial?.sameWorkload),
  );
  const [quality, setQuality] = useState<TrialQuality | "">("");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const before = baselineMinutes.trim()
      ? parseMinutes(baselineMinutes)
      : null;
    const after = parseMinutes(minutes);
    if (!workload.trim()) {
      setError("Describe the amount of work completed.");
      return;
    }
    if (
      (baselineMinutes.trim() && before == null) ||
      (baselineTrial && before == null)
    ) {
      setError(
        "Enter a baseline greater than 0 minutes, or cancel to leave it unknown.",
      );
      return;
    }
    if (!baselineTrial && (after == null || !quality)) {
      setError(
        "Enter a total time greater than 0 and choose whether the result met your requirements.",
      );
      return;
    }
    const wording = baselineTrial?.taskWording ?? task.wording;
    const nextBaseline: TaskBaseline | undefined =
      before != null && comparable
        ? { minutes: before, workload: workload.trim(), taskWording: wording }
        : undefined;
    try {
      onSave((current) => {
        if (baselineTrial)
          return {
            ...current,
            baseline: nextBaseline ?? current.baseline,
            trials: current.trials.map((trial) =>
              trial.id === baselineTrial.id
                ? {
                    ...trial,
                    baselineMinutes: before,
                    sameWorkload: comparable,
                  }
                : trial,
            ),
          };
        const trial: TaskTrial = {
          id: createTaskId(),
          createdAt: new Date().toISOString(),
          taskWording: wording,
          workload: workload.trim(),
          minutes: after!,
          quality: quality as TrialQuality,
          baselineMinutes: before,
          sameWorkload: before != null && comparable,
        };
        return {
          baseline: nextBaseline ?? current.baseline,
          trials: [trial, ...current.trials],
        };
      });
      onClose();
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "Could not save this record. Please try again.",
      );
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="profile-dialog-surface w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle>
            {baselineTrial ? "Add baseline time" : "Record an AI trial"}
          </DialogTitle>
          <DialogDescription>
            {baselineTrial?.taskWording ?? task.wording}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <FormField
            label="Work completed"
            hint="For example: summarised 20 stock records. Use a comparable amount of work for timing comparisons."
          >
            <Textarea
              className="min-h-20"
              rows={2}
              required
              maxLength={300}
              readOnly={Boolean(baselineTrial)}
              value={workload}
              onChange={(event) => {
                setWorkload(event.target.value);
                setComparable(false);
                const saved = matchingBaseline(
                  baseline,
                  task.wording,
                  event.target.value,
                );
                setBaselineMinutes(saved == null ? "" : String(saved));
              }}
            />
          </FormField>
          <div className="grid items-start gap-5 sm:grid-cols-2">
            {!baselineTrial && (
              <FormField
                label="Total time using AI (minutes)"
                hint="Include preparation, using AI, checking and correcting its output."
              >
                <Input
                  required
                  type="number"
                  min="0.1"
                  max="100000"
                  step="0.1"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </FormField>
            )}
            <FormField
              label="Usual time without AI (minutes)"
              hint={
                baselineTrial
                  ? "An estimate is fine."
                  : "Optional. An estimate is fine; leave blank if unknown or you already used AI before."
              }
            >
              <Input
                required={Boolean(baselineTrial)}
                type="number"
                min="0.1"
                max="100000"
                step="0.1"
                value={baselineMinutes}
                onChange={(e) => setBaselineMinutes(e.target.value)}
              />
            </FormField>
            {!baselineTrial && (
              <FormField label="Did the result meet your requirements?">
                <FormSelect
                  label="Did the result meet your requirements?"
                  required
                  placeholder="Choose a result"
                  value={quality}
                  onValueChange={(value) => setQuality(value as TrialQuality)}
                  options={[
                    { value: "met", label: "Met requirements" },
                    { value: "partly", label: "Partly met requirements" },
                    { value: "not_met", label: "Did not meet requirements" },
                  ]}
                />
              </FormField>
            )}
            {baselineMinutes && (
              <label className="flex items-start gap-2 text-sm text-[#574a55]">
                <input
                  className="mt-1 accent-[#4f91ba]"
                  type="checkbox"
                  checked={comparable}
                  onChange={(e) => setComparable(e.target.checked)}
                />
                This baseline is for the same amount of work and a similar task.
              </label>
            )}
            {!baselineMinutes && (
              <p className="text-xs text-[#7f7280]">
                You can save this trial now and add a baseline later.
              </p>
            )}
          </div>
          <p className="text-xs text-[#7f7280]">
            Saved in this browser with your task profile.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="profile-blue-btn rounded-full">
              {baselineTrial ? "Save baseline" : "Save trial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, FormSelect, Textarea } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIME_SPENT_OPTIONS } from "@/pages/WorkProfile/taskOptions";
import type { TaskEditorValues } from "@/pages/WorkProfile/types";
import { aiService } from "@/services/aiService";
import { referenceService } from "@/services/referenceService";
import { validateTaskTitle } from "@/utils/validation";

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initialValues: TaskEditorValues;
  occupationCode?: string;
  onClose: () => void;
  onSave: (values: TaskEditorValues) => void;
};
export default function TaskEditorDialog({
  open,
  mode,
  initialValues,
  occupationCode,
  onClose,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [standardTaskStatus, setStandardTaskStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [standardTaskMatch, setStandardTaskMatch] = useState<{
    taskText: string;
    confidence: number;
    reason: string;
  } | null>(null);

  const findClosestStandardTask = async () => {
    if (!occupationCode || values.wording.trim().length < 3) return;
    setStandardTaskStatus("loading");
    setStandardTaskMatch(null);
    try {
      const rows = await referenceService.tasks(occupationCode);
      if (rows.length === 0) {
        setStandardTaskStatus("error");
        return;
      }
      const response = await aiService.taskMatch({
        occupation_code: occupationCode,
        user_task: values.wording.trim(),
        candidates: rows.map((task) => ({
          id: task.task_id,
          text: task.task_text,
        })),
      });
      const chosen =
        rows.find((task) => task.task_id === response.candidate_id) ?? null;
      setStandardTaskMatch(
        chosen
          ? {
              taskText: chosen.task_text,
              confidence: response.confidence,
              reason: response.reason,
            }
          : null,
      );
      setStandardTaskStatus("done");
    } catch {
      setStandardTaskStatus("error");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="profile-dialog-surface max-h-[90dvh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add a task" : "Edit task"}
          </DialogTitle>
          <DialogDescription>
            Describe what you do. You can add timing information later, when you
            record an AI trial.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const issue = validateTaskTitle(values.wording);
            if (issue) {
              setError(issue);
              return;
            }
            try {
              onSave({
                ...values,
                wording: values.wording.trim(),
                notes: values.notes.trim(),
              });
              onClose();
            } catch {
              setError("Your changes could not be saved. Please try again.");
            }
          }}
        >
          <FormField label="Task description">
            <Textarea
              required
              maxLength={500}
              value={values.wording}
              onChange={(e) =>
                setValues({ ...values, wording: e.target.value })
              }
            />
          </FormField>
          <div className="space-y-2">
            <span className="block text-sm font-semibold text-[#2f2430]">
              Standard task check
            </span>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={
                standardTaskStatus === "loading" ||
                !occupationCode ||
                values.wording.trim().length < 3
              }
              onClick={() => void findClosestStandardTask()}
            >
              {standardTaskStatus === "loading"
                ? "Checking…"
                : "Find closest standard task"}
            </Button>
            <span className="block text-xs leading-5 text-[#7f7280]">
              Compare your wording with the occupation&apos;s standard task
              list. Suggestions need your review before they count.
            </span>
            {standardTaskStatus === "done" && standardTaskMatch ? (
              <div className="rounded-2xl border border-[#eadde4] bg-white/70 p-3 text-sm leading-6 text-[#574a55]">
                <p className="text-sm font-semibold text-[#3d5f7a]">
                  Closest standard task
                </p>
                <p className="mt-1">{standardTaskMatch.taskText}</p>
                <p className="mt-1 text-xs text-[#7f7280]">
                  Match confidence {standardTaskMatch.confidence.toFixed(2)}.{" "}
                  {standardTaskMatch.reason}
                </p>
                <p className="mt-2 text-xs text-[#7f7280]">
                  Suggestion only — review it before relying on it.
                </p>
              </div>
            ) : null}
            {standardTaskStatus === "done" && !standardTaskMatch ? (
              <p className="text-xs text-[#7f7280]">
                No reliable standard task was found for this wording.
              </p>
            ) : null}
            {standardTaskStatus === "error" ? (
              <p className="text-xs text-[#7f7280]">
                The standard-task check is unavailable right now.
              </p>
            ) : null}
          </div>
          <FormField
            label="Task frequency (optional)"
            hint="How often you do this task, rather than how long it takes."
          >
            <FormSelect
              label="Task frequency (optional)"
              placeholder="Not specified"
              value={values.timeSpent}
              onValueChange={(timeSpent) => setValues({ ...values, timeSpent })}
              options={TIME_SPENT_OPTIONS.map(option => ({ ...option, label: option.value ? option.label : "Not specified" }))}
            />
          </FormField>
          <FormField
            label="Anything specific about how you do this task? (optional)"
            hint="For example, the software you use, what you produce, or special requirements."
          >
            <Textarea
              rows={3}
              maxLength={1000}
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="profile-dialog-cancel-btn rounded-full"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="profile-dialog-btn rounded-full">
              {mode === "add" ? "Add task" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

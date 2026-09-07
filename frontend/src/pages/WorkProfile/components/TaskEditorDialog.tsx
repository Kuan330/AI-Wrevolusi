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
import { validateTaskTitle } from "@/utils/validation";

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initialValues: TaskEditorValues;
  onClose: () => void;
  onSave: (values: TaskEditorValues) => void;
};
export default function TaskEditorDialog({
  open,
  mode,
  initialValues,
  onClose,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
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

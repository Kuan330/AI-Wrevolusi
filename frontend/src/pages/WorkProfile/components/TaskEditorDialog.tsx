import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RESPONSIBILITY_OPTIONS, TIME_SPENT_OPTIONS } from "@/pages/WorkProfile/taskOptions";
import type { TaskEditorValues } from "@/pages/WorkProfile/types";
import { validateTaskTitle } from "@/utils/validation";

type TaskEditorDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  initialValues: TaskEditorValues;
  onClose: () => void;
  onSave: (values: TaskEditorValues) => void;
};

const emptyValues = (): TaskEditorValues => ({
  wording: "",
  timeSpent: "",
  responsibility: "",
});

const TaskEditorDialog = ({ open, mode, initialValues, onClose, onSave }: TaskEditorDialogProps) => {
  const [values, setValues] = useState<TaskEditorValues>(emptyValues);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setFormError(null);
    }
  }, [open, initialValues]);

  const updateField = (field: keyof TaskEditorValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const validationError = validateTaskTitle(values.wording);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    onSave({
      wording: values.wording.trim(),
      timeSpent: values.timeSpent,
      responsibility: values.responsibility,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="profile-dialog-surface max-w-lg rounded-[24px] border border-white/80 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#2f2430]">
            {mode === "add" ? "Add a task" : "Edit task"}
          </DialogTitle>
          <DialogDescription className="text-[#574a55]">
            {mode === "add"
              ? "Describe a task you actually do. Time and responsibility are optional."
              : "Confirm your changes to update this task in your list."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[#2f2430]">Task wording</span>
            <input
              value={values.wording}
              onChange={(event) => updateField("wording", event.target.value)}
              className="h-12 w-full rounded-xl border border-white/80 bg-white/90 px-4 text-sm outline-none focus:border-[#4f91ba] focus:ring-4 focus:ring-[#4f91ba]/10"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#2f2430]">Approx. time (optional)</span>
              <select
                value={values.timeSpent}
                onChange={(event) => updateField("timeSpent", event.target.value)}
                className="h-12 w-full rounded-xl border border-white/80 bg-white/90 px-4 text-sm outline-none focus:border-[#4f91ba]"
              >
                {TIME_SPENT_OPTIONS.map((option) => (
                  <option key={option.value || "skip"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[#2f2430]">Responsibility (optional)</span>
              <select
                value={values.responsibility}
                onChange={(event) => updateField("responsibility", event.target.value)}
                className="h-12 w-full rounded-xl border border-white/80 bg-white/90 px-4 text-sm outline-none focus:border-[#4f91ba]"
              >
                {RESPONSIBILITY_OPTIONS.map((option) => (
                  <option key={option.value || "skip"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:space-x-0">
          <Button
            type="button"
            className="profile-dialog-cancel-btn h-10 rounded-full px-5 font-normal"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="profile-dialog-btn h-10 rounded-full px-5 font-normal"
            onClick={handleSave}
          >
            {mode === "add" ? "Add task" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditorDialog;

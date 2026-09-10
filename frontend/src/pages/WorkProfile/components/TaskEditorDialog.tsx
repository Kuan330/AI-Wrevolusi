import type { ComponentProps } from "react";
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
export default function TaskEditorDialog(props: Props) {
  const { open, mode, initialValues, onClose, onSave } = props;
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const dialogProps1 = {
    open: open,
    onOpenChange: (value) => !value && onClose(),
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  const textareaProps2 = {
    required: true,
    maxLength: 500,
    value: values.wording,
    onChange: (e) => setValues({ ...values, wording: e.target.value }),
  } satisfies Partial<ComponentProps<typeof Textarea>>;
  const formFieldProps3 = {
    label: "Task frequency (optional)",
    hint: "How often you do this task, rather than how long it takes.",
  } satisfies Partial<ComponentProps<typeof FormField>>;
  const formSelectProps4 = {
    label: "Task frequency (optional)",
    placeholder: "Not specified",
    value: values.timeSpent,
    onValueChange: (timeSpent) => setValues({ ...values, timeSpent }),
    options: TIME_SPENT_OPTIONS.map((option) => ({
      ...option,
      label: option.value ? option.label : "Not specified",
    })),
  } satisfies Partial<ComponentProps<typeof FormSelect>>;
  const formFieldProps5 = {
    label: "Anything specific about how you do this task? (optional)",
    hint: "For example, the software you use, what you produce, or special requirements.",
  } satisfies Partial<ComponentProps<typeof FormField>>;
  const textareaProps6 = {
    rows: 3,
    maxLength: 1000,
    value: values.notes,
    onChange: (e) => setValues({ ...values, notes: e.target.value }),
  } satisfies Partial<ComponentProps<typeof Textarea>>;
  const buttonProps7 = {
    type: "button",
    variant: "outline",
    className: "profile-dialog-cancel-btn rounded-full",
    onClick: onClose,
  } satisfies Partial<ComponentProps<typeof Button>>;
  const buttonProps8 = {
    type: "submit",
    className: "profile-dialog-btn rounded-full",
  } satisfies Partial<ComponentProps<typeof Button>>;
  return (
    <Dialog {...dialogProps1}>
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
            <Textarea {...textareaProps2} />
          </FormField>
          <FormField {...formFieldProps3}>
            <FormSelect {...formSelectProps4} />
          </FormField>
          <FormField {...formFieldProps5}>
            <Textarea {...textareaProps6} />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button {...buttonProps7}>Cancel</Button>
            <Button {...buttonProps8}>
              {mode === "add" ? "Add task" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

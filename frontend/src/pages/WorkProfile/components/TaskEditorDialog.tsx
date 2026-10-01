import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileTask, TaskEditorValues } from "@/features/work-profile/types";
import { cleanDisplayText } from "@/lib/displayText";
import { useStandardTaskMatch } from "@/pages/WorkProfile/hooks/useStandardTaskMatch";
import { countTaskMatchWords, MIN_TASK_MATCH_WORDS } from "@/pages/WorkProfile/taskMatchWords";
import { validateTaskTitle } from "@/utils/validation";
import "../work-scene.css";

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initialValues: TaskEditorValues;
  occupationCode?: string;
  existingTasks?: ProfileTask[];
  editingTaskId?: string;
  onClose: () => void;
  onSave: (values: TaskEditorValues) => void;
};
const sameTaskText = (left: string, right: string) =>
  left.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim()
  === right.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
export default function TaskEditorDialog({
  open,
  mode,
  initialValues,
  occupationCode,
  existingTasks = [],
  editingTaskId,
  onClose,
  onSave,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const { status, match, retry } = useStandardTaskMatch({
    enabled: open && Boolean(occupationCode),
    occupationCode,
    wording: values.wording,
  });
  const needsWords = countTaskMatchWords(values.wording) < MIN_TASK_MATCH_WORDS;
  const wordMessage = `Write at least ${MIN_TASK_MATCH_WORDS} words that describe what you actually do.`;
  const duplicateMessage = "This task is already in your list.";
  const duplicate = existingTasks.some(task => {
    if (task.id === editingTaskId) return false;
    const listed = [task.wording, task.originalWording].filter((text): text is string => Boolean(text));
    if (listed.some(text => sameTaskText(text, values.wording))) return true;
    return status === "matched" && Boolean(match && (listed.some(text => sameTaskText(text, match.taskText)) || task.iloTaskId === match.taskId));
  });
  const saveIssue = needsWords
    ? wordMessage
    : duplicate
      ? duplicateMessage
      : !occupationCode || status === "matched" || status === "no_match"
        ? null
        : status === "below_minimum"
          ? wordMessage
          : status === "error"
            ? "The check could not finish. Try again before saving."
            : "Looking for a matching standard task…";

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="task-editor-dialog"
        overlayClassName="task-editor-overlay"
        style={{ background: "linear-gradient(155deg, #fffdfb, #faf5f4)" }}
      >
        <DialogTitle className="task-editor-title">
          {mode === "add" ? "Add a task" : "Edit task"}
        </DialogTitle>
        <DialogDescription className="task-editor-copy">
          Write this task the way you actually do it.
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const issue = validateTaskTitle(values.wording) ?? saveIssue;
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
          <label htmlFor="task-editor-wording">Task description</label>
          <textarea
            id="task-editor-wording"
            required
            maxLength={500}
            value={values.wording}
            onChange={(event) => setValues({ ...values, wording: event.target.value })}
          />
          {values.wording.trim() && saveIssue && status !== "loading" && <div className="task-editor-match" role="alert"><p>{saveIssue}{status === "error" && <> <button type="button" onClick={retry}>Try again</button></>}</p></div>}
          {status === "loading" && <div className="task-editor-match" role="status"><p>Looking for a matching standard task…</p></div>}
          {status === "no_match" && !duplicate && <div className="task-editor-match" role="status"><p>No matching standard task was found. Your wording will be kept.</p></div>}
          {status === "matched" && match && !duplicate && <div className="task-editor-match" role="status"><strong>Closest standard task</strong><p>{cleanDisplayText(match.taskText)}</p></div>}
          {error && error !== saveIssue && <p role="alert" className="task-editor-error">{error}</p>}
          <div className="task-editor-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={Boolean(saveIssue)}>{mode === "add" ? "Add task" : "Save changes"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

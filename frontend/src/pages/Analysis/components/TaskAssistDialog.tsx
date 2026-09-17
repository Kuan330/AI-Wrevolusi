import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/services/api";
import { aiService } from "@/services/aiService";
import type { TaskAssistInteraction } from "@/services/aiService";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import {
  DEFAULT_TASK_ASSIST_QUESTION,
  shouldApplyTaskAssistResult,
  taskAssistContextKey,
  taskAssistResponseLabel,
} from "@/pages/AIExposure/lib/taskAssistState";

type TaskAssistDialogProps = {
  open: boolean;
  task: ProfileTask | null;
  interaction: TaskAssistInteraction;
  onStarted: (interaction: TaskAssistInteraction) => void;
  onCompleted: (interaction: TaskAssistInteraction) => void;
  onOpenChange: (open: boolean) => void;
};

const TaskAssistDialogSession = (props: TaskAssistDialogProps) => {
  const { open, task, interaction, onStarted, onCompleted, onOpenChange } = props;
  const [input, setInput] = useState(DEFAULT_TASK_ASSIST_QUESTION);
  const [result, setResult] = useState(interaction);
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const mountedRef = useRef(true);
  const completed = result.status === "completed";
  const displayedQuestion = result.question ?? submittedQuestion;

  useEffect(
    () => () => {
      mountedRef.current = false;
      requestSequence.current += 1;
      activeRequest.current?.abort();
    },
    [],
  );

  const send = async () => {
    if (!task || !input.trim() || sending || completed) return;
    const userMessage = input.trim();
    const requestContextKey = taskAssistContextKey(
      task.id,
      task.wording,
      task.notes ?? "",
    );
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setSubmittedQuestion(userMessage);
    setSending(true);
    setError("");
    const pending: TaskAssistInteraction = {
      ...interaction,
      status: "pending",
      question: userMessage,
    };
    setResult(pending);
    onStarted(pending);
    try {
      const saved = await aiService.taskAssist(
        {
          task_key: interaction.task_key,
          user_message: userMessage,
        },
        controller.signal,
      );
      if (
        !shouldApplyTaskAssistResult(
          requestId,
          requestSequence.current,
          mountedRef.current && open,
          requestContextKey,
          requestContextKey,
        )
      ) {
        return;
      }
      setResult(saved);
      onCompleted(saved);
    } catch (err) {
      if (
        controller.signal.aborted ||
        !shouldApplyTaskAssistResult(
          requestId,
          requestSequence.current,
          mountedRef.current && open,
          requestContextKey,
          requestContextKey,
        )
      ) {
        return;
      }
      setError(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Could not generate assistance.",
      );
    } finally {
      if (requestId === requestSequence.current) {
        activeRequest.current = null;
        setSending(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[65]"
        className="task-assist-dialog z-[70] flex max-h-[min(36rem,85vh)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl"
      >
        <DialogHeader className="border-b border-[#eadde4] px-5 py-4 text-left">
          <DialogTitle>Chat with AI</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {task?.wording ?? "Task assistance"}
          </DialogDescription>
        </DialogHeader>

        <div
          aria-live="polite"
          aria-atomic="false"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
        >
          {!displayedQuestion ? (
            <p className="text-sm leading-6 text-[#7f7280]">
              Send the suggested prompt, or edit it first. This Task Detail allows
              one permanently saved question and answer.
            </p>
          ) : (
            <div className="ml-8 rounded-2xl bg-[#d6eaf7] px-3.5 py-2.5 text-sm leading-6 text-[#2f2430]">
              {displayedQuestion}
            </div>
          )}
          {completed && result.reply ? (
            <div className="mr-8 rounded-2xl border border-[#eadde4] bg-white/80 px-3.5 py-2.5 text-sm leading-6 text-[#574a55]">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#7f7280]">
                {taskAssistResponseLabel(result.generated_by_model === true)}
              </p>
              <span>{result.reply}</span>
            </div>
          ) : null}
          {sending ? (
            <p role="status" className="text-xs text-[#7f7280]">
              Thinking…
            </p>
          ) : null}
          {error ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-[#a15b5b]">
                {error}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void send()}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {completed ? (
            <p className="text-xs text-[#7f7280]">
              This saved exchange is permanent. No further questions can be sent
              for this Task Detail.
            </p>
          ) : null}
        </div>

        {!completed ? (
          <form
            className="flex items-end gap-2 border-t border-[#eadde4] px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={2}
              maxLength={2000}
              disabled={sending || completed}
              className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-[#d6e4f0] bg-white/90 px-3 py-2 text-sm text-[#2f2430] outline-none focus-visible:ring-2 focus-visible:ring-[#9ec9e4] disabled:opacity-60"
              aria-label="Message to AI"
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0 rounded-full"
              disabled={!input.trim() || sending || completed}
              aria-label="Send message"
            >
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const TaskAssistDialog = (props: TaskAssistDialogProps) => {
  const { open, task } = props;
  const contextKey = task
    ? taskAssistContextKey(task.id, task.wording, task.notes ?? "")
    : "no-task";

  return (
    <TaskAssistDialogSession
      key={`${open ? "open" : "closed"}:${contextKey}`}
      {...props}
    />
  );
};

export default TaskAssistDialog;

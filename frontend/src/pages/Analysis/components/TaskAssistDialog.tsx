import { useEffect, useState } from "react";
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
import type { ProfileTask } from "@/pages/WorkProfile/types";

const DEFAULT_TEMPLATE = "How can AI assist me in completing this task?";

type TaskAssistDialogProps = {
  open: boolean;
  task: ProfileTask | null;
  onOpenChange: (open: boolean) => void;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const TaskAssistDialog = (props: TaskAssistDialogProps) => {
  const { open, task, onOpenChange } = props;
  const [input, setInput] = useState(DEFAULT_TEMPLATE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const completed = messages.some((item) => item.role === "assistant");

  useEffect(() => {
    if (!open) return;
    setInput(DEFAULT_TEMPLATE);
    setMessages([]);
    setSending(false);
    setError("");
  }, [open, task?.id]);

  const send = async () => {
    if (!task || !input.trim() || sending || completed) return;
    const userMessage = input.trim();
    setMessages([{ role: "user", content: userMessage }]);
    setSending(true);
    setError("");
    try {
      const result = await aiService.taskAssist({
        task_text: task.wording,
        notes: task.notes ?? "",
        user_message: userMessage,
      });
      setMessages([
        { role: "user", content: userMessage },
        { role: "assistant", content: result.reply },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Could not generate assistance.",
      );
      setMessages([{ role: "user", content: userMessage }]);
    } finally {
      setSending(false);
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="text-sm leading-6 text-[#7f7280]">
              Send the suggested prompt, or edit it first. This is a single-turn
              reply for now.
            </p>
          ) : null}
          {messages.map((message) => (
            <div
              key={`${message.role}-${message.content.slice(0, 24)}`}
              className={
                message.role === "user"
                  ? "ml-8 rounded-2xl bg-[#d6eaf7] px-3.5 py-2.5 text-sm leading-6 text-[#2f2430]"
                  : "mr-8 rounded-2xl border border-[#eadde4] bg-white/80 px-3.5 py-2.5 text-sm leading-6 text-[#574a55]"
              }
            >
              {message.content}
            </div>
          ))}
          {sending ? (
            <p className="text-xs text-[#7f7280]">Thinking…</p>
          ) : null}
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-[#a15b5b]">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void send()}>
                Retry
              </Button>
            </div>
          ) : null}
          {completed ? (
            <p className="text-xs text-[#7f7280]">
              Single-turn for now. Close and reopen to ask again.
            </p>
          ) : null}
        </div>

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
      </DialogContent>
    </Dialog>
  );
};

export default TaskAssistDialog;

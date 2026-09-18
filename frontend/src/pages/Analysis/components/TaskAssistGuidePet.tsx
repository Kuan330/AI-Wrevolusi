import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_TASK_ASSIST_QUESTION,
  taskAssistResponseLabel,
} from "@/pages/AIExposure/lib/taskAssistState";
import type { TaskAssistStatus } from "@/pages/AIExposure/lib/taskAssistState";
import "@/components/common/bot-pet.css";

type TaskAssistGuidePetProps = {
  status: TaskAssistStatus;
  question: string | null;
  reply: string | null;
  generatedByModel: boolean;
  /** Local request in flight before status flips to pending/completed. */
  generating?: boolean;
  error?: string;
  onRequestGuidance: () => void;
};

/**
 * Drawer companion for Task Assist.
 * Click starts generation; after save, click toggles the guidance bubble.
 */
export default function TaskAssistGuidePet({
  status,
  question,
  reply,
  generatedByModel,
  generating = false,
  error = "",
  onRequestGuidance,
}: TaskAssistGuidePetProps) {
  const [open, setOpen] = useState(false);
  const thinking = generating || status === "pending";
  const saved = status === "completed" && Boolean(question && reply);
  const canStart = status === "available" && !generating;
  const showBubble = thinking || Boolean(error) || (saved && open);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    setOpen(false);
    autoOpenedRef.current = false;
  }, [question, reply, status]);

  // Show the reply once when generation finishes.
  useEffect(() => {
    if (saved && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setOpen(true);
    }
  }, [saved]);

  const handleClick = () => {
    if (thinking) return;
    if (canStart || error) {
      onRequestGuidance();
      return;
    }
    if (saved) {
      setOpen((value) => !value);
    }
  };

  let title = "Ask for AI guidance";
  let ariaLabel = "Ask for AI guidance on this task";
  if (thinking) {
    title = "Generating guidance…";
    ariaLabel = "Generating AI guidance";
  } else if (error) {
    title = "Click to retry";
    ariaLabel = "Retry AI guidance";
  } else if (saved) {
    title = open ? "Click to hide guidance" : "Click to show guidance";
    ariaLabel = open ? "Hide saved AI guidance" : "Show saved AI guidance";
  }

  return (
    <div
      className={`task-assist-pet${showBubble ? " is-open" : ""}${thinking ? " is-thinking" : ""}`}
    >
      {showBubble ? (
        <div
          className="task-assist-pet__bubble"
          role="status"
          onClick={(event) => event.stopPropagation()}
        >
          {thinking ? (
            <p className="task-assist-pet__thinking">Thinking…</p>
          ) : null}

          {error && !thinking ? (
            <div className="task-assist-pet__error">
              <p role="alert">{error}</p>
              <p className="task-assist-pet__note">Click the companion to retry.</p>
            </div>
          ) : null}

          {saved && !thinking ? (
            <>
              <p className="task-assist-pet__eyebrow">Saved AI guidance</p>
              <p className="task-assist-pet__question">
                {question ?? DEFAULT_TASK_ASSIST_QUESTION}
              </p>
              <div className="task-assist-pet__reply">
                <p className="task-assist-pet__label">
                  {taskAssistResponseLabel(generatedByModel)}
                </p>
                <p>{reply}</p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="task-assist-pet__avatar"
        aria-expanded={showBubble}
        aria-busy={thinking}
        aria-label={ariaLabel}
        title={title}
        disabled={thinking}
        onClick={handleClick}
      >
        <span
          className={`bot-pet__sprite${showBubble || thinking ? " is-waving" : ""}`}
          aria-hidden
        />
      </button>
    </div>
  );
}

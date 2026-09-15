import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import "./message.css";

export type MessageType = "info" | "success" | "warning" | "error";

type MessageItem = {
  id: string;
  type: MessageType;
  content: ReactNode;
  duration: number;
};

type MessageOptions = {
  content: ReactNode;
  type?: MessageType;
  duration?: number;
};

const DEFAULT_DURATION_MS = 2500;
const MAX_VISIBLE = 3;

type Listener = (items: MessageItem[]) => void;

let items: MessageItem[] = [];
const listeners = new Set<Listener>();
let seed = 0;
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

const emit = () => {
  listeners.forEach((listener) => listener(items));
};

const remove = (id: string) => {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
  items = items.filter((item) => item.id !== id);
  emit();
};

const push = (options: MessageOptions) => {
  const id = `msg-${++seed}`;
  const duration = options.duration ?? DEFAULT_DURATION_MS;
  const next: MessageItem = {
    id,
    type: options.type ?? "info",
    content: options.content,
    duration,
  };
  items = [next, ...items].slice(0, MAX_VISIBLE);
  emit();
  if (duration > 0) {
    dismissTimers.set(
      id,
      setTimeout(() => {
        remove(id);
      }, duration),
    );
  }
  return id;
};

const open = (content: ReactNode, duration?: number) =>
  push({ content, type: "info", duration });

const success = (content: ReactNode, duration?: number) =>
  push({ content, type: "success", duration });

const warning = (content: ReactNode, duration?: number) =>
  push({ content, type: "warning", duration });

const error = (content: ReactNode, duration?: number) =>
  push({ content, type: "error", duration });

const info = (content: ReactNode, duration?: number) =>
  push({ content, type: "info", duration });

const destroy = (id?: string) => {
  if (id) {
    remove(id);
    return;
  }
  dismissTimers.forEach((timer) => clearTimeout(timer));
  dismissTimers.clear();
  items = [];
  emit();
};

/** Imperative global message API (Ant Design–style top tips). */
export const message = {
  open,
  info,
  success,
  warning,
  error,
  destroy,
};

const typeIcon = {
  info: Info,
  success: CheckCircle2,
  warning: CircleAlert,
  error: XCircle,
} as const;

/** Mount once near the app root to render global messages. */
export function MessageHost() {
  const [queue, setQueue] = useState<MessageItem[]>(items);

  useEffect(() => {
    const listener: Listener = (next) => setQueue(next);
    listeners.add(listener);
    setQueue(items);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (queue.length === 0) return null;

  return (
    <div className="app-message-host" aria-live="polite" aria-relevant="additions">
      {queue.map((item) => {
        const Icon = typeIcon[item.type];
        return (
          <div
            key={item.id}
            className={cn("app-message", `is-${item.type}`)}
            role="status"
          >
            <Icon className="app-message__icon" aria-hidden />
            <span className="app-message__content">{item.content}</span>
          </div>
        );
      })}
    </div>
  );
}

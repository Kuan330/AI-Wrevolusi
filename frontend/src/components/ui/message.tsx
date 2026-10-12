import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, XCircle, X } from "lucide-react";

import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "./dialog";
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
  const existing = items.find(item => item.type === (options.type ?? "info") && item.content === options.content);
  if (existing) return existing.id;
  const id = `msg-${++seed}`;
  const duration = options.duration ?? DEFAULT_DURATION_MS;
  const next: MessageItem = {
    id,
    type: options.type ?? "info",
    content: options.content,
    duration,
  };
  for (const dropped of items.slice(MAX_VISIBLE - 1)) { const timer = dismissTimers.get(dropped.id); if (timer) clearTimeout(timer); dismissTimers.delete(dropped.id); }
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
  push({ content, type: "error", duration: duration ?? 7000 });

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
  confirm,
  async action<T>(operation: () => Promise<T>, successText: string): Promise<T> {
    try { const value = await operation(); success(successText); return value; }
    catch (cause) { error(cause instanceof Error ? cause.message : "The operation failed. Please try again."); throw cause; }
  },
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
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ type: MessageType; content: string }>).detail;
      if (detail?.type === "error") error(detail.content); else if (detail?.type === "success") success(detail.content);
    };
    window.addEventListener("api-operation-result", receive);
    return () => window.removeEventListener("api-operation-result", receive);
  }, []);

  useEffect(() => {
    const listener: Listener = (next) => setQueue(next);
    listeners.add(listener);
    setQueue(items);
    return () => {
      listeners.delete(listener);
    };
  }, []);



  return (
    <><ConfirmationHost /><div className="app-message-host" aria-live="polite" aria-relevant="additions">
      {queue.map((item) => {
        const Icon = typeIcon[item.type];
        return (
          <div
            key={item.id}
            className={cn("app-message", `is-${item.type}`)}
            role={item.type === "error" ? "alert" : "status"}
          >
            <Icon className="app-message__icon" aria-hidden />
            <span className="app-message__content">{item.content}</span><button type="button" className="app-message__dismiss" aria-label="Dismiss notification" onClick={() => remove(item.id)}><X size={15} /></button>
          </div>
        );
      })}
    </div></>
  );
}


type Confirmation = { text: string; resolve: (value: boolean) => void };
let pendingConfirmation: Confirmation | null = null;
const confirmListeners = new Set<() => void>();
function confirm(text: string): Promise<boolean> {
  if (pendingConfirmation) return Promise.resolve(false);
  return new Promise(resolve => { pendingConfirmation = { text, resolve }; confirmListeners.forEach(listener => listener()); });
}
function ConfirmationHost() {
  const [request, setRequest] = useState(pendingConfirmation);
  useEffect(() => { const update = () => setRequest(pendingConfirmation); confirmListeners.add(update); return () => { confirmListeners.delete(update); pendingConfirmation?.resolve(false); pendingConfirmation = null; }; }, []);
  const finish = (result: boolean) => { pendingConfirmation?.resolve(result); pendingConfirmation = null; setRequest(null); };
  return <Dialog open={Boolean(request)} onOpenChange={open => { if (!open) finish(false); }}><DialogContent><DialogTitle>Confirm removal</DialogTitle><DialogDescription>{request?.text}</DialogDescription><DialogFooter><Button autoFocus variant="outline" onClick={() => finish(false)}>Cancel</Button><Button variant="destructive" onClick={() => finish(true)}>Remove</Button></DialogFooter></DialogContent></Dialog>;
}

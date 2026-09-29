import { DEFAULT_TASK_ASSIST_QUESTION, taskAssistResponseLabel } from "@/pages/AIExposure/lib/taskAssistState";
import type { TaskAssistStatus } from "@/pages/AIExposure/lib/taskAssistState";
import { Button } from "@/components/ui/button";

type TaskAssistGuideProps = {
  status: TaskAssistStatus;
  question: string | null;
  reply: string | null;
  generatedByModel: boolean;
  generating?: boolean;
  error?: string;
  onRequestGuidance: () => void;
};

/** Task guidance stays in the drawer flow, alongside the task it explains. */
export default function TaskAssistGuide({ status, question, reply, generatedByModel, generating = false, error = "", onRequestGuidance }: TaskAssistGuideProps) {
  const thinking = generating || status === "pending";
  const saved = status === "completed" && Boolean(question && reply);
  const canStart = status === "available" || Boolean(error);
  return <section className="mt-4 space-y-3 rounded-xl border border-[#ded5e1] bg-white p-4" aria-label="AI guidance for this task">
    <h3 className="font-semibold">AI guidance for this task</h3>
    {thinking && <p role="status">Preparing guidance…</p>}
    {error && !thinking && <p role="alert">{error}</p>}
    {saved && !thinking && <details open>
      <summary className="cursor-pointer font-medium">Saved guidance</summary>
      <p className="mt-3 text-sm">{question ?? DEFAULT_TASK_ASSIST_QUESTION}</p>
      <p className="mt-3 text-sm font-semibold">{taskAssistResponseLabel(generatedByModel)}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{reply}</p>
    </details>}
    {(!saved || error) && <Button disabled={thinking || !canStart} onClick={onRequestGuidance}>{thinking ? "Preparing guidance…" : error ? "Retry AI guidance" : "Get AI guidance for this task"}</Button>}
  </section>;
}

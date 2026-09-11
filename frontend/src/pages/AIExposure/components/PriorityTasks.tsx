import type { ComponentProps } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TaskDetailsDrawer from "@/pages/Analysis/components/TaskDetailsDrawer";
import type { TaskOverview } from "../lib/taskOverview";

type PriorityItem = TaskOverview["priorities"][number];

type PriorityTasksProps = {
  tasks: TaskOverview["priorities"];
  className?: string;
};

const buildAssistanceTemplate = (item: PriorityItem) => {
  const reasoning =
    item.assessment?.reasoning?.trim() ||
    "This task may involve steps that generative AI can draft, summarise, or speed up — while you keep judgement and accountability.";

  return {
    summary: reasoning,
    helpsWith: [
      "Draft first versions of lists, messages, scripts, or comparison tables for this task.",
      "Summarise options and flag what still needs your review before you decide.",
      "Check wording for clarity and consistency so you spend less time on routine edits.",
    ],
    stillNeedsYou: [
      "Final decisions, pricing, approvals, and accountability stay with you.",
      "Local context, relationships, and sensitive judgement cannot be handed off to AI.",
      "Validate any AI output against your organisation’s rules and real-world constraints.",
    ],
  };
};

export default function PriorityTasks(props: PriorityTasksProps) {
  const { tasks, className } = props;
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);

  const detailsItem = tasks.find(({ task }) => task.id === detailsId) ?? null;
  const assistItem = tasks.find(({ task }) => task.id === assistId) ?? null;
  const assistance = assistItem ? buildAssistanceTemplate(assistItem) : null;

  const taskDetailsDrawerProps1 = {
    selectedTask: detailsItem?.task ?? null,
    selectedAssessment: detailsItem?.assessment ?? null,
    onClose: () => setDetailsId(null),
  } satisfies Partial<ComponentProps<typeof TaskDetailsDrawer>>;
  const dialogProps2 = {
    open: assistItem !== null,
    onOpenChange: (open) => {
      if (!open) setAssistId(null);
    },
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  return (
    <section
      className={`exposure-glass-card priority-tasks ${className ?? ""}`.trim()}
    >
      <p className="exposure-eyebrow">Where to start</p>
      <h2 className="exposure-title">Your highest-exposure tasks</h2>
      <p className="exposure-caption">
        The highest scores across your confirmed tasks, independent of the
        filter. Start by reviewing how these tasks may change.
      </p>
      {tasks.length === 0 ? (
        <p className="exposure-caption">No task scores are available yet.</p>
      ) : (
        <ol className="priority-tasks__list">
          {tasks.map((item, index) => (
            <li key={item.task.id} className="priority-tasks__item">
              <span className="priority-tasks__rank">{index + 1}</span>
              <div className="priority-tasks__content">
                <h3>{item.task.wording}</h3>
                <p className="priority-tasks__reason">
                  {item.assessment?.reasoning ||
                    "Review the available evidence and explanation for this task."}
                </p>
                <div className="priority-tasks__actions">
                  <Button
                    {...({
                      variant: "outline",
                      className: "task-details-button",
                      onClick: () => setAssistId(item.task.id),
                    } satisfies Partial<ComponentProps<typeof Button>>)}
                  >
                    AI assistance
                  </Button>
                  <Button
                    {...({
                      variant: "outline",
                      className: "task-details-button",
                      onClick: () => setDetailsId(item.task.id),
                    } satisfies Partial<ComponentProps<typeof Button>>)}
                  >
                    View details
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <TaskDetailsDrawer {...taskDetailsDrawerProps1} />

      <Dialog {...dialogProps2}>
        <DialogContent className="max-w-lg border-white/80 bg-[#fffafe]/95 text-[#2f2430] backdrop-blur-xl">
          {assistItem && assistance ? (
            <>
              <DialogHeader>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7f7280]">
                  AI assistance
                </p>
                <DialogTitle className="text-left text-lg leading-snug">
                  How AI can help with this task
                </DialogTitle>
                <DialogDescription className="text-left text-sm leading-6 text-[#574a55]">
                  {assistItem.task.wording}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm leading-6 text-[#574a55]">
                <section className="rounded-2xl border border-[#eadde4] bg-white/70 p-4">
                  <h3 className="text-sm font-semibold text-[#3d5f7a]">
                    Why this task is in focus
                  </h3>
                  <p className="mt-2">{assistance.summary}</p>
                </section>

                <section className="rounded-2xl border border-[#eadde4] bg-white/70 p-4">
                  <h3 className="text-sm font-semibold text-[#3d5f7a]">
                    Where AI can assist
                  </h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    {assistance.helpsWith.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border border-[#eadde4] bg-white/70 p-4">
                  <h3 className="text-sm font-semibold text-[#3d5f7a]">
                    What still needs you
                  </h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    {assistance.stillNeedsYou.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <p className="text-xs leading-5 text-[#7f7280]">
                  This is a first-version template based on your task evidence.
                  It is guidance for learning and redesign — not a promise that
                  AI can replace this work.
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

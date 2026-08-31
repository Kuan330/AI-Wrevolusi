import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MatchIssueKind = "not_a_task" | "service" | "duplicate" | "similar";

type MatchIssueDialogProps = {
  open: boolean;
  kind: MatchIssueKind;
  existingTaskWording?: string | null;
  onRewrite: () => void;
  onDiscard: () => void;
  onAddAnyway?: () => void;
};

const COPY: Record<
  MatchIssueKind,
  { title: string; body: (existing?: string | null) => string; primary: string }
> = {
  not_a_task: {
    title: "Please rethink this task",
    body: () =>
      "This does not look like a real work activity. Describe something you actually do at work, such as planning schedules or serving customers.",
    primary: "Rewrite task",
  },
  service: {
    title: "Scoring is unavailable",
    body: () =>
      "We could not reach the scoring service. You can edit the task and try again, or discard this change.",
    primary: "Edit task",
  },
  duplicate: {
    title: "This task is already in your list",
    body: (existing) =>
      existing
        ? `You already have this task: "${existing}". Edit the existing task or describe something different.`
        : "You already have a task with the same wording. Edit the existing task or describe something different.",
    primary: "Rewrite task",
  },
  similar: {
    title: "This looks similar to an existing task",
    body: (existing) =>
      existing
        ? `This is very close to: "${existing}". Do you still want to add it?`
        : "This is very close to a task already in your list. Do you still want to add it?",
    primary: "Rewrite task",
  },
};

const MatchIssueDialog = ({
  open,
  kind,
  existingTaskWording,
  onRewrite,
  onDiscard,
  onAddAnyway,
}: MatchIssueDialogProps) => {
  const discarding = useRef(false);
  const copy = COPY[kind];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return;
        if (discarding.current) {
          discarding.current = false;
          return;
        }
        onRewrite();
      }}
    >
      <DialogContent className="max-w-md rounded-[28px] border-0 bg-[#FBF6F4] p-8 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-[#5C3A36]">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm leading-6">{copy.body(existingTaskWording)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="h-11 rounded-full bg-[#5C3A36] px-6 text-white hover:bg-[#4a2e2b]"
            onClick={onRewrite}
          >
            {copy.primary}
          </Button>
          {kind === "similar" && onAddAnyway ? (
            <Button type="button" variant="outline" className="h-11 rounded-full bg-white px-6" onClick={onAddAnyway}>
              Add anyway
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full bg-white px-6"
            onClick={() => {
              discarding.current = true;
              onDiscard();
            }}
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MatchIssueDialog;

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

type MatchIssueKind = "not_a_task" | "service";

type MatchIssueDialogProps = {
  open: boolean;
  kind: MatchIssueKind;
  onRewrite: () => void;
  onDiscard: () => void;
};

const COPY: Record<MatchIssueKind, { title: string; body: string; primary: string }> = {
  not_a_task: {
    title: "Please rethink this task",
    body: "This does not look like a real work activity. Describe something you actually do at work, such as planning schedules or serving customers.",
    primary: "Rewrite task",
  },
  service: {
    title: "Scoring is unavailable",
    body: "We could not reach the scoring service. You can edit the task and try again, or discard this change.",
    primary: "Edit task",
  },
};

const MatchIssueDialog = ({ open, kind, onRewrite, onDiscard }: MatchIssueDialogProps) => {
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
          <DialogDescription className="text-sm leading-6">{copy.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="h-11 rounded-full bg-[#5C3A36] px-6 text-white hover:bg-[#4a2e2b]"
            onClick={onRewrite}
          >
            {copy.primary}
          </Button>
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

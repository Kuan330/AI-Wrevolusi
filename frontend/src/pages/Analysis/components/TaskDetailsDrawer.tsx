import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

import { useAccount } from "@/components/account/useAccount";
import TaskAssistDialog from "@/pages/Analysis/components/TaskAssistDialog";
import TaskRelatedSkills from "@/pages/Analysis/components/TaskRelatedSkills";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import ExposureScorePanel from "@/components/ui/exposure-score-panel";
import { taskScore } from "@/pages/Analysis/lib/taskScore";
import {
  canStartTaskAssist,
  hasSavedTaskAssist,
  taskAssistContextKey,
  taskAssistResponseLabel,
} from "@/pages/AIExposure/lib/taskAssistState";
import type { ProfileTask } from "@/features/work-profile/types";
import { ApiError } from "@/services/api";
import { aiService } from "@/services/aiService";
import type { TaskAssistInteraction } from "@/services/aiService";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { ChevronDown, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import "./TaskDetailsDrawer.css";

const formatTaskAssessmentMatchLayer = (
  matchLayer: ConfirmedTaskExposureAssessment["match_layer"],
) => {
  if (matchLayer === "exact") return "Exact ILO task evidence";
  if (matchLayer === "nlp") return "NLP task-text match";
  if (matchLayer === "llm") return "LLM-reviewed task match";
  return "No reliable evidence match";
};

const SignedInTaskAssistAccess = ({ task }: { task: ProfileTask }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [interaction, setInteraction] =
    useState<TaskAssistInteraction | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void aiService
      .registerTaskAssistDetails(
        {
          details: [
            {
              task_key: task.id,
              task_text: task.wording,
              notes: task.notes ?? "",
            },
          ],
        },
        controller.signal,
      )
      .then((response) => {
        if (!controller.signal.aborted) {
          setInteraction(response.items[0] ?? null);
          setError("");
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof ApiError
            ? caught.detail
            : "Could not load saved AI guidance.",
        );
      });
    return () => controller.abort();
  }, [retryKey, task.id, task.notes, task.wording]);

  useEffect(() => {
    if (interaction?.status !== "pending") return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      void aiService
        .getTaskAssist(interaction.task_key)
        .then((saved) => {
          if (!active) return;
          if (saved.status === "available" && attempts < 6) {
            attempts += 1;
            timer = setTimeout(poll, 1500);
            return;
          }
          setInteraction(saved);
          if (saved.status === "pending") {
            timer = setTimeout(poll, 1500);
          }
        })
        .catch(() => {
          if (active) timer = setTimeout(poll, 1500);
        });
    };
    timer = setTimeout(poll, 1500);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [interaction?.status, interaction?.task_key]);

  useEffect(() => {
    if (interaction?.status === "completed" && chatOpen) {
      setChatOpen(false);
    }
  }, [interaction?.status, chatOpen]);

  if (error) {
    return (
      <div className="task-details__footer flex-col items-start gap-2">
        <p role="alert" className="text-sm text-[#a15b5b]">
          {error}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setError("");
            setRetryKey((value) => value + 1);
          }}
        >
          Retry AI guidance status
        </Button>
      </div>
    );
  }

  if (!interaction) {
    return (
      <div className="task-details__footer">
        <p role="status" className="text-xs text-[#7f7280]">
          Checking saved AI guidance…
        </p>
      </div>
    );
  }

  const saved = hasSavedTaskAssist(interaction.status);
  const canStart = canStartTaskAssist(interaction.status);

  return (
    <>
      {saved && interaction.question && interaction.reply ? (
        <section className="mx-5 mb-4 space-y-3 rounded-2xl border border-[#eadde4] bg-white/80 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7f7280]">
              Saved AI guidance
            </p>
            <p className="mt-1 text-sm leading-6 text-[#2f2430]">
              {interaction.question}
            </p>
          </div>
          <div className="rounded-xl bg-[#f7f1f4] p-3 text-sm leading-6 text-[#574a55]">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#7f7280]">
              {taskAssistResponseLabel(
                interaction.generated_by_model === true,
              )}
            </p>
            <p>{interaction.reply}</p>
          </div>
          <p className="text-xs text-[#7f7280]">
            This is the permanent response for this Task Detail. Further questions
            are disabled.
          </p>
        </section>
      ) : null}

      {canStart ? (
        <div className="task-details__footer">
          <Button
            type="button"
            variant="ghost"
            className="task-details__chat-btn"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare className="size-4" aria-hidden />
            Chat with AI
          </Button>
        </div>
      ) : interaction.status === "pending" ? (
        <div className="task-details__footer">
          <p role="status" className="text-xs text-[#7f7280]">
            AI guidance is already being generated for this Task Detail.
          </p>
        </div>
      ) : null}

      {canStart || chatOpen ? (
        <TaskAssistDialog
          open={chatOpen}
          task={task}
          interaction={interaction}
          onStarted={setInteraction}
          onCompleted={setInteraction}
          onOpenChange={setChatOpen}
        />
      ) : null}
    </>
  );
};

const TaskAssistAccess = ({ task }: { task: ProfileTask }) => {
  const { user } = useAccount();
  if (!user) return null;
  return <SignedInTaskAssistAccess task={task} />;
};

export default function TaskDetailsDrawer(props: {
  selectedTask: ProfileTask | null;
  selectedAssessment: ConfirmedTaskExposureAssessment | null;
  onClose: () => void;
}) {
  const { selectedTask, selectedAssessment, onClose } = props;
  const [detailOpen, setDetailOpen] = useState(false);
  const selectedScore = selectedTask
    ? taskScore(selectedTask, selectedAssessment)
    : null;

  const drawerProps1 = {
    open: selectedTask !== null,
    onOpenChange: (open) => {
      if (!open) {
        setDetailOpen(false);
        onClose();
      }
    },
  } satisfies Partial<ComponentProps<typeof Drawer>>;

  return (
    <Drawer {...drawerProps1}>
      <DrawerContent
        aria-describedby="task-details-description"
        className="task-details-drawer"
      >
        {selectedTask ? (
          <>
            <DrawerHeader>
              <p className="task-details__eyebrow">Task details</p>
              <DrawerTitle>{selectedTask.wording}</DrawerTitle>
              <DrawerDescription id="task-details-description">
                Related skills and score for this task.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="task-details__body">
              <div className="task-details__content-area">
                <ExposureScorePanel
                  {...({
                    score: selectedScore,
                    className: "mb-4",
                  } satisfies Partial<ComponentProps<typeof ExposureScorePanel>>)}
                />
                {selectedScore == null ? (
                  <p className="task-details__unavailable mb-4">
                    No published task score is available for this item.
                  </p>
                ) : null}

                <TaskRelatedSkills taskText={selectedTask.wording} />

                <div className="task-details__detail-block">
                  <Button
                    type="button"
                    variant="outline"
                    className="task-details__detail-toggle"
                    aria-expanded={detailOpen}
                    onClick={() => setDetailOpen((open) => !open)}
                  >
                    Evidence and Source
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        detailOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </Button>
                  {detailOpen ? (
                    <section className="task-details__explanation">
                      {selectedAssessment ? (
                        <div className="task-details__evidence is-open">
                          <p>
                            <strong>Evidence method:</strong>{" "}
                            {formatTaskAssessmentMatchLayer(
                              selectedAssessment.match_layer,
                            )}
                          </p>
                          <p>
                            <strong>Uncertainty:</strong>{" "}
                            {selectedAssessment.uncertainty}
                          </p>
                          <p>
                            <strong>Limitations:</strong>{" "}
                            {selectedAssessment.limitations}
                          </p>
                          {selectedAssessment.matched_reference_tasks[0] ? (
                            <p>
                              <strong>Closest ILO task evidence:</strong>{" "}
                              {
                                selectedAssessment.matched_reference_tasks[0]
                                  .task_text
                              }
                            </p>
                          ) : null}
                          <p>
                            <strong>Source:</strong>{" "}
                            <a
                              href={selectedAssessment.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="task-details__source-link"
                            >
                              {selectedAssessment.source_name} (
                              {selectedAssessment.source_year})
                            </a>
                          </p>
                        </div>
                      ) : (
                        <p className="task-details__reason">
                          This task does not have a current ILO evidence match.
                          Return to your tasks and run the assessment again.
                        </p>
                      )}
                    </section>
                  ) : null}
                </div>
              </div>

              <div className="task-details__assist-container">
                <TaskAssistAccess
                  key={taskAssistContextKey(
                    selectedTask.id,
                    selectedTask.wording,
                    selectedTask.notes ?? "",
                  )}
                  task={selectedTask}
                />
              </div>
            </DrawerBody>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

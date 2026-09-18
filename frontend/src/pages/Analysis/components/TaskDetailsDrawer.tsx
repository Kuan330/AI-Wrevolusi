import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

import { useAccount } from "@/components/account/useAccount";
import TaskAssistGuidePet from "@/pages/Analysis/components/TaskAssistGuidePet";
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
  DEFAULT_TASK_ASSIST_QUESTION,
  taskAssistContextKey,
} from "@/pages/AIExposure/lib/taskAssistState";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import { ApiError } from "@/services/api";
import { aiService } from "@/services/aiService";
import type { TaskAssistInteraction } from "@/services/aiService";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { ChevronDown } from "lucide-react";
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
  const [interaction, setInteraction] =
    useState<TaskAssistInteraction | null>(null);
  const [error, setError] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

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
          setGenerateError("");
          setGenerating(false);
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
    return () => {
      controller.abort();
      requestRef.current?.abort();
    };
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
          setGenerating(false);
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

  const requestGuidance = async () => {
    if (!interaction || generating) return;
    if (interaction.status === "completed" || interaction.status === "pending") {
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setGenerating(true);
    setGenerateError("");
    const pending: TaskAssistInteraction = {
      ...interaction,
      status: "pending",
      question: DEFAULT_TASK_ASSIST_QUESTION,
    };
    setInteraction(pending);
    try {
      const saved = await aiService.taskAssist(
        {
          task_key: interaction.task_key,
          user_message: DEFAULT_TASK_ASSIST_QUESTION,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setInteraction(saved);
      setGenerating(false);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setGenerating(false);
      setInteraction((current) =>
        current
          ? { ...current, status: "available", question: null, reply: null }
          : current,
      );
      setGenerateError(
        caught instanceof ApiError
          ? caught.detail
          : caught instanceof Error
            ? caught.message
            : "Could not generate assistance.",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  };

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

  return (
    <TaskAssistGuidePet
      status={interaction.status}
      question={interaction.question}
      reply={interaction.reply}
      generatedByModel={interaction.generated_by_model === true}
      generating={generating}
      error={generateError}
      onRequestGuidance={() => {
        void requestGuidance();
      }}
    />
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
            </DrawerBody>

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
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

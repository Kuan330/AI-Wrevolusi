import type { ComponentProps } from "react";
import { useState } from "react";

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
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { ChevronDown, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const formatTaskAssessmentMatchLayer = (
  matchLayer: ConfirmedTaskExposureAssessment["match_layer"],
) => {
  if (matchLayer === "exact") return "Exact ILO task evidence";
  if (matchLayer === "nlp") return "NLP task-text match";
  if (matchLayer === "llm") return "LLM-reviewed task match";
  return "No reliable evidence match";
};

export default function TaskDetailsDrawer(props: {
  selectedTask: ProfileTask | null;
  selectedAssessment: ConfirmedTaskExposureAssessment | null;
  onClose: () => void;
}) {
  const { selectedTask, selectedAssessment, onClose } = props;
  const [chatOpen, setChatOpen] = useState(false);
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
    <>
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
                <ExposureScorePanel
                  {...({
                    score: selectedScore,
                    className: "mb-4",
                  } satisfies Partial<
                    ComponentProps<typeof ExposureScorePanel>
                  >)}
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
              </DrawerBody>

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
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
      <TaskAssistDialog
        open={chatOpen}
        task={selectedTask}
        onOpenChange={setChatOpen}
      />
    </>
  );
}

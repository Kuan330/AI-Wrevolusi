import "./TaskDetailsDrawer.css";
import { GradientBar } from "@/components/ui/gradient-bar";
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { taskScore } from "@/pages/Analysis/lib/taskScore";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
const formatTaskAssessmentMatchLayer = (
  matchLayer: ConfirmedTaskExposureAssessment["match_layer"],
) => {
  if (matchLayer === "exact") return "Exact ILO task evidence";
  if (matchLayer === "nlp") return "NLP task-text match";
  return "No reliable evidence match";
};

export default function TaskDetailsDrawer({ selectedTask, selectedAssessment, onClose }: {
 selectedTask: ProfileTask | null;
 selectedAssessment: ConfirmedTaskExposureAssessment | null;
 onClose: () => void;
}) {
 const selectedScore = selectedTask ? taskScore(selectedTask, selectedAssessment) : null;
 return (
      <Drawer
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DrawerContent aria-describedby="task-details-description">
          {selectedTask ? (
            <>
              <DrawerHeader>
                <p className="task-details__eyebrow">
                  Task details
                </p>
                <DrawerTitle>{selectedTask.wording}</DrawerTitle>
                <DrawerDescription id="task-details-description">
                  The evidence and explanation attached to this task.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                {selectedScore != null ? (
                  <section className="task-details__score-panel">
                    <div className="task-details__score-heading">
                      <h3 className="task-details__score-title">Task exposure score</h3>
                      <p className="task-details__score-value">
                        <strong className="task-details__score-number">{selectedScore.toFixed(2)}</strong>
                        <span className="task-details__score-scale">/ 1.0</span>
                      </p>
                    </div>
                    <GradientBar
                      value={selectedScore * 100}
                      aria-label={`Task exposure score ${selectedScore.toFixed(2)} out of 1`}
                    />
                  </section>
                ) : null}
                <section className="task-details__explanation">
                  <div>
                    <h3 className="task-details__score-title">
                      Why this possible transformation was suggested
                    </h3>
                    <p className="task-details__reason">
                      {selectedAssessment?.reasoning ??
                        "This task does not have a current ILO evidence match. Return to your tasks and run the assessment again."}
                    </p>
                  </div>
                  {selectedAssessment ? (
                    <div className="task-details__evidence">
                      <p>
                        <strong>Evidence method:</strong>{" "}
                        {formatTaskAssessmentMatchLayer(selectedAssessment.match_layer)}
                      </p>
                      <p><strong>Uncertainty:</strong> {selectedAssessment.uncertainty}</p>
                      <p><strong>Limitations:</strong> {selectedAssessment.limitations}</p>
                      {selectedAssessment.matched_reference_tasks[0] ? (
                        <p>
                          <strong>Closest ILO task evidence:</strong>{" "}
                          {selectedAssessment.matched_reference_tasks[0].task_text}
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
                          {selectedAssessment.source_name} ({selectedAssessment.source_year})
                        </a>
                      </p>
                    </div>
                  ) : null}
                  {selectedScore == null ? (
                    <p className="task-details__unavailable">No published task score is available for this item.</p>
                  ) : null}
                </section>
              </DrawerBody>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
 );
}

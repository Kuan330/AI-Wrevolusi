import type { ComponentProps } from "react";
import "./ScoreInfoModal.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ExposureScoreExplanation from "@/pages/Analysis/components/ExposureScoreExplanation";
export default function ScoreInfoModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { open, onOpenChange } = props;
  const dialogProps1 = {
    open: open,
    onOpenChange: onOpenChange,
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  const dialogContentProps2 = {
    className: "score-modal__content",
    "aria-describedby": "exposure-score-details-description",
  } satisfies Partial<ComponentProps<typeof DialogContent>>;
  const dialogDescriptionProps3 = {
    id: "exposure-score-details-description",
    className: "score-modal__description",
  } satisfies Partial<ComponentProps<typeof DialogDescription>>;
  return (
    <Dialog {...dialogProps1}>
      <DialogContent {...dialogContentProps2}>
        <DialogHeader className="score-modal__header">
          <p className="score-modal__eyebrow">AI exposure</p>
          <DialogTitle className="score-modal__title">
            What the exposure score means
          </DialogTitle>
          <DialogDescription {...dialogDescriptionProps3}>
            How to read the occupational mean score and its ILO classification
            limits.
          </DialogDescription>
        </DialogHeader>
        <div>
          <ExposureScoreExplanation />
        </div>
      </DialogContent>
    </Dialog>
  );
}

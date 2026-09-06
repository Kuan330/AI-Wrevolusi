import "./ScoreInfoModal.css";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExposureScoreExplanation from "@/pages/Analysis/components/ExposureScoreExplanation";
export default function ScoreInfoModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="score-modal__content"
          aria-describedby="exposure-score-details-description"
        >
          <DialogHeader className="score-modal__header">
            <p className="score-modal__eyebrow">
              AI exposure
            </p>
            <DialogTitle className="score-modal__title">What the exposure score means</DialogTitle>
            <DialogDescription id="exposure-score-details-description" className="score-modal__description">
              How to read the occupational mean score and its ILO classification limits.
            </DialogDescription>
          </DialogHeader>
          <div>
            <ExposureScoreExplanation />
          </div>
        </DialogContent>
      </Dialog>
  );
}

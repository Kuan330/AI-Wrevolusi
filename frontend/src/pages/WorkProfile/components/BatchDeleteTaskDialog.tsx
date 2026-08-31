import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BatchDeleteTaskDialogProps = {
  open: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
};

const BatchDeleteTaskDialog = ({ open, count, onClose, onConfirm }: BatchDeleteTaskDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="profile-dialog-surface max-w-md rounded-[24px] border border-white/80 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#2f2430]">
            Remove {count} {count === 1 ? "task" : "tasks"}?
          </DialogTitle>
          <DialogDescription className="text-[#574a55]">
            This will remove the selected tasks from your profile. You can add them back later if
            needed.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button
            type="button"
            className="profile-dialog-cancel-btn h-10 rounded-full px-5 font-normal"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="profile-dialog-btn h-10 rounded-full px-5 font-normal"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Remove {count} {count === 1 ? "task" : "tasks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchDeleteTaskDialog;

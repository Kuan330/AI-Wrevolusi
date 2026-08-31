import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteTaskDialogProps = {
  open: boolean;
  taskWording: string;
  onClose: () => void;
  onConfirm: () => void;
};

const DeleteTaskDialog = ({ open, taskWording, onClose, onConfirm }: DeleteTaskDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="profile-dialog-surface max-w-md rounded-[24px] border border-white/80 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#2f2430]">Remove this task?</DialogTitle>
          <DialogDescription className="text-[#574a55]">
            This will remove the task from your profile. You can add it back later if needed.
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-sm leading-6 text-[#2f2430]">
          {taskWording}
        </p>

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
            Remove task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTaskDialog;

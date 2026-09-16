import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RemoveSkillDialogProps = {
  open: boolean;
  skillName: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export default function RemoveSkillDialog(props: RemoveSkillDialogProps) {
  const { open, skillName, onOpenChange, onConfirm } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove skill?</DialogTitle>
          <DialogDescription>
            Remove{" "}
            <strong className="text-[#2f2430]">{skillName ?? "this skill"}</strong>{" "}
            from your learning skills? Courses you added for this skill that are not linked to another skill will also
            be removed from your learning list.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

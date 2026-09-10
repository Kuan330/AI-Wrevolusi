import type { ComponentProps } from "react";
import type { ReactNode } from "react";

import { AppButton } from "@/components/ui/app-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

const ConfirmDialog = (props: ConfirmDialogProps) => {
  const {
    open,
    title,
    description,
    confirmLabel,
    onClose,
    onConfirm,
    children,
  } = props;
  const dialogProps1 = {
    open: open,
    onOpenChange: (nextOpen) => !nextOpen && onClose(),
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  const appButtonProps2 = {
    type: "button",
    className: "profile-dialog-cancel-btn font-normal",
    onClick: onClose,
  } satisfies Partial<ComponentProps<typeof AppButton>>;
  const appButtonProps3 = {
    type: "button",
    className: "profile-dialog-btn font-normal",
    onClick: () => {
      onConfirm();
      onClose();
    },
  } satisfies Partial<ComponentProps<typeof AppButton>>;
  return (
    <Dialog {...dialogProps1}>
      <DialogContent className="profile-dialog-surface max-w-md rounded-[24px] border border-white/80 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[#2f2430]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[#574a55]">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2 sm:space-x-0">
          <AppButton {...appButtonProps2}>Cancel</AppButton>
          <AppButton {...appButtonProps3}>{confirmLabel}</AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDialog;

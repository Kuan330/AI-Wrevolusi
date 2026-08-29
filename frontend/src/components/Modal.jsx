import { useEffect } from "react";
import { Button } from "./Button";

export function Modal({
  title,
  children,
  onClose,
  actions,
  wide = false,
  nested = false,
  dismissOnBackdrop = true,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (nested) e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, nested);
    return () => document.removeEventListener("keydown", onKey, nested);
  }, [onClose, nested]);

  return (
    <div
      className={["modal-backdrop", nested ? "nested" : ""].filter(Boolean).join(" ")}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissOnBackdrop) onClose();
      }}
    >
      <div className={["modal", wide ? "wide" : ""].filter(Boolean).join(" ")} role="dialog" aria-modal="true">
        {title ? <h2>{title}</h2> : null}
        {children}
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmBar({ cancelLabel = "Cancel", okLabel = "OK", onCancel, onOk, danger = false }) {
  return (
    <>
      <Button variant="ghost" type="button" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant={danger ? "danger" : "primary"} type="button" onClick={onOk}>
        {okLabel}
      </Button>
    </>
  );
}

import type { ComponentProps } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormField, Input } from "@/components/ui/form-field";
import { AppButton } from "@/components/ui/app-button";
import { Button } from "@/components/ui/button";
import { useAccount } from "./useAccount";
import { ROUTES } from "@/constants/routes";

export function AuthDialog(props: {
  open: boolean;
  onClose: () => void;
  destination?: string;
}) {
  const { open, onClose, destination } = props;
  const { authenticate } = useAccount();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [importGuest, setImportGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogProps1 = {
    open: open,
    onOpenChange: (value) => {
      if (!value && !busy) onClose();
    },
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  const dialogContentProps2 = {
    className: "profile-dialog-surface rounded-3xl",
    onEscapeKeyDown: (e) => {
      if (busy) e.preventDefault();
    },
    onPointerDownOutside: (e) => {
      if (busy) e.preventDefault();
    },
  } satisfies Partial<ComponentProps<typeof DialogContent>>;
  const formFieldProps3 = {
    label: "Username",
    hint: "3–32 letters, numbers or underscores. Usernames are not case-sensitive.",
  } satisfies Partial<ComponentProps<typeof FormField>>;
  const inputProps4 = {
    required: true,
    autoComplete: "username",
    minLength: 3,
    maxLength: 32,
    pattern: "[a-zA-Z0-9_]+",
    value: username,
    onChange: (e) => setUsername(e.target.value),
    disabled: busy,
  } satisfies Partial<ComponentProps<typeof Input>>;
  const formFieldProps5 = {
    label: "Password",
    hint:
      mode === "register"
        ? "Use at least 8 characters. Save your username and password in your password manager; email recovery is not available."
        : undefined,
  } satisfies Partial<ComponentProps<typeof FormField>>;
  const inputProps6 = {
    required: true,
    type: "password",
    minLength: 8,
    maxLength: 128,
    autoComplete: mode === "login" ? "current-password" : "new-password",
    value: password,
    onChange: (e) => setPassword(e.target.value),
    disabled: busy,
  } satisfies Partial<ComponentProps<typeof Input>>;
  const appButtonProps7 = {
    type: "submit",
    disabled: busy,
    className: "w-full",
    tone: "gradient",
  } satisfies Partial<ComponentProps<typeof AppButton>>;
  const buttonProps8 = {
    type: "button",
    variant: "link",
    className: "w-full",
    disabled: busy,
    onClick: () => {
      setMode(mode === "login" ? "register" : "login");
      setError("");
      setPassword("");
      setConfirm("");
    },
  } satisfies Partial<ComponentProps<typeof Button>>;
  return (
    <Dialog {...dialogProps1}>
      <DialogContent {...dialogContentProps2}>
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            Keep your learning choices and plans together. No email is required.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (mode === "register" && password !== confirm) {
              setError("Your passwords do not match.");
              return;
            }
            setBusy(true);
            try {
              await authenticate(mode, username.trim(), password, importGuest);
              onClose();
              navigate(
                mode === "register"
                  ? ROUTES.workProfile
                  : (destination ?? ROUTES.aiExposure),
              );
            } catch (issue) {
              setError(
                issue instanceof Error
                  ? issue.message
                  : "Could not sign in. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormField {...formFieldProps3}>
            <Input {...inputProps4} />
          </FormField>
          <FormField {...formFieldProps5}>
            <Input {...inputProps6} />
          </FormField>
          {mode === "register" && (
            <>
              <FormField label="Confirm password">
                <Input
                  {...({
                    required: true,
                    type: "password",
                    autoComplete: "new-password",
                    value: confirm,
                    onChange: (e) => setConfirm(e.target.value),
                    disabled: busy,
                  } satisfies Partial<ComponentProps<typeof Input>>)}
                />
              </FormField>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={importGuest}
                  onChange={(e) => setImportGuest(e.target.checked)}
                  disabled={busy}
                />{" "}
                Save my current work profile and learning choices to this
                account.
              </label>
            </>
          )}
          {mode === "login" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={importGuest}
                onChange={(e) => setImportGuest(e.target.checked)}
                disabled={busy}
              />{" "}
              Keep learning themes selected in this browser.
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AppButton {...appButtonProps7}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </AppButton>
          <Button {...buttonProps8}>
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Log in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

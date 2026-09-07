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
import {
  hasConfirmedAnalysis,
  readTaskWorkspace,
} from "@/pages/WorkProfile/userProfile";
import { ROUTES } from "@/constants/routes";

export function AuthDialog({
  open,
  onClose,
  destination,
}: {
  open: boolean;
  onClose: () => void;
  destination?: string;
}) {
  const { authenticate } = useAccount();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [importGuest, setImportGuest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent
        className="profile-dialog-surface rounded-3xl"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
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
                destination ??
                  (hasConfirmedAnalysis()
                    ? ROUTES.aiExposure
                    : readTaskWorkspace()?.tasksOccupationCode
                      ? ROUTES.task
                      : ROUTES.workProfile),
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
          <FormField
            label="Username"
            hint="3–32 letters, numbers or underscores. Usernames are not case-sensitive."
          >
            <Input
              required
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_]+"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />
          </FormField>
          <FormField
            label="Password"
            hint={
              mode === "register"
                ? "Use at least 8 characters. Save your username and password in your password manager; email recovery is not available."
                : undefined
            }
          >
            <Input
              required
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </FormField>
          {mode === "register" && (
            <>
              <FormField label="Confirm password">
                <Input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={busy}
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
          <AppButton
            type="submit"
            disabled={busy}
            className="w-full"
            tone="gradient"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </AppButton>
          <Button
            type="button"
            variant="link"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setPassword("");
              setConfirm("");
            }}
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Log in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

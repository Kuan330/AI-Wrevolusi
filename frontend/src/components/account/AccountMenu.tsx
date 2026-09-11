import type { ComponentProps } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAccount } from "./useAccount";
import { AuthDialog } from "./AuthDialog";
export default function AccountMenu(props: { iconOnly?: boolean }) {
  const { iconOnly = false } = props;
  const { user, logout } = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  if (!user)
    return (
      <>
        <Button
          {...({
            "aria-label": "Log in or create an account",
            variant: "outline",
            className: "shrink-0 rounded-full",
            onClick: () => setAuthOpen(true),
          } satisfies Partial<ComponentProps<typeof Button>>)}
        >
          {iconOnly ? (
            <User
              {...({
                className: "size-4",
                "aria-hidden": "true",
              } satisfies Partial<ComponentProps<typeof User>>)}
            />
          ) : (
            "Log in"
          )}
        </Button>
        {authOpen && (
          <AuthDialog
            {...({
              open: true,
              onClose: () => setAuthOpen(false),
            } satisfies Partial<ComponentProps<typeof AuthDialog>>)}
          />
        )}
      </>
    );
  const buttonProps1 = {
    variant: "ghost",
    disabled: busy,
    className: "mt-2 w-full justify-start border-t",
    onClick: async () => {
      setBusy(true);
      setError("");
      try {
        await logout();
        setOpen(false);
        navigate(ROUTES.home, { replace: true });
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not log out. Please try again.",
        );
      } finally {
        setBusy(false);
      }
    },
  } satisfies Partial<ComponentProps<typeof Button>>;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Account menu"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/80 text-[#4f91ba]"
      >
        <User className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup className="w-64 rounded-2xl border border-white bg-white p-4 shadow-xl">
            <Popover.Title className="mb-3 font-semibold text-[#326889]">
              {user.username}
            </Popover.Title>
            {[
              [ROUTES.workProfile, "My work profile"],
              [ROUTES.task, "Edit my tasks"],
            ].map(([path, label]) => (
              <Link
                key={label}
                {...({
                  to: path,
                  state:
                    path === ROUTES.workProfile &&
                    location.pathname !== ROUTES.workProfile
                      ? { returnTo: location.pathname + location.search }
                      : location.state,
                  onClick: () => setOpen(false),
                  className:
                    "block rounded-lg px-3 py-2 text-sm hover:bg-[#eaf3fb]",
                } satisfies Partial<ComponentProps<typeof Link>>)}
              >
                {label}
              </Link>
            ))}
            <Button {...buttonProps1}>Log out</Button>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

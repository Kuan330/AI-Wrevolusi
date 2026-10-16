import type { ComponentProps } from "react";
import { AccountContext as Context, type Account } from "./useAccount";
import { clearSelectedOccupation } from "@/features/work-profile/userProfile";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/services/api";
import { authService } from "@/services/authService";
import {
  activateWorkspace,
  clearWorkspaceOnLogout,
  accountStorage,
  currentWorkspaceOwner,
  flushWorkspace,
  workspaceKeys,
  syncError,
} from "@/services/accountStorage";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "./AuthDialog";

export function AccountProvider(props: { children: ReactNode }) {
  const { children } = props;
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, refresh] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  async function load(account: Account) {
    const data = await api.get<{
      owner_id: string;
      data: Record<string, string>;
      revision: number;
    }>("/account/workspace");
    if (data.owner_id !== account.id)
      throw new Error("Your signed-in account changed. Please reload.");
    clearSelectedOccupation();
    activateWorkspace(account.id, data);
    setUser(account);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const account = await api.get<Account>("/account/me");
        if (active) await load(account);
      } catch (e) {
        if (active) {
          activateWorkspace(null);
          setUser(null);
          if (!(e instanceof ApiError) || e.status !== 401)
            setError(
              "Account service is unavailable. Please try again to load your saved work.",
            );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    // Keep the workspace and page mounted so unsent edits survive reauthentication.
    const expired = () => { if (user) setSessionExpired(true); };
    window.addEventListener("api-session-expired", expired);
    return () => window.removeEventListener("api-session-expired", expired);
  }, [user]);
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    window.addEventListener("workspace-change", update);
    return () => window.removeEventListener("workspace-change", update);
  }, []);
  async function authenticate(
    mode: "login" | "register",
    username: string,
    password: string,
    importGuest: boolean,
  ) {
    const guest = Object.fromEntries(
      workspaceKeys.flatMap((key) => {
        const value = accountStorage.getItem(key);
        return value ? [[key, value]] : [];
      }),
    );
    const account = await api.post<Account>(
      `/account/${mode}`,
      {
        username,
        password,
      },
      15_000,
    );
    // Same-account renewal must retain in-memory drafts and workspace session guards.
    if (user?.id === account.id && currentWorkspaceOwner() === account.id) setUser(account);
    else await load(account);
    setSessionExpired(false);
    setError("");
    if (importGuest && mode === "login") {
      if (guest["aiwrevolusi.learningCentre"]) {
        const key = "aiwrevolusi.learningCentre";
        const current = JSON.parse(accountStorage.getItem(key) ?? "[]");
        const incoming = JSON.parse(guest[key]);
        if (Array.isArray(current) && Array.isArray(incoming)) {
          const merged = new Map(
            [...current, ...incoming]
              .filter((item) => item?.theme_id)
              .map((item) => [item.theme_id, item]),
          );
          accountStorage.setItem(key, JSON.stringify([...merged.values()]));
        }
      }
      await flushWorkspace();
    }
  }
  async function logout() {
    await flushWorkspace();
    await authService.logout();
    clearSelectedOccupation();
    clearWorkspaceOnLogout();
    setUser(null);
    setSessionExpired(false);
  }
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
        authenticate,
        logout,
        reload: () => {
          setLoading(true);
          setError("");
          setAttempt((v) => v + 1);
        },
      }}
    >
      {user && sessionExpired && (
        <div role="alert" className="bg-amber-50 px-5 py-3 text-sm text-amber-950">
          Your session expired. Log in again to continue. Your local drafts are kept.
          <Button variant="link" onClick={() => setLoginOpen(true)}>Log in again</Button>
        </div>
      )}
      {user && loginOpen && <AuthDialog open onClose={() => setLoginOpen(false)} reauthenticateUser={user.username} />}
      {error && !loading && (
        <div role="alert" className="bg-amber-50 px-5 py-3 text-sm text-amber-950">
          We could not restore your account. Your saved work has not been reset.
          <Button variant="link" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Retry account restore</Button>
        </div>
      )}
      {user && syncError && (
        <div
          role="alert"
          className="bg-rose-50 px-5 py-2 text-sm text-rose-900"
        >
          {syncError}{" "}
          <Button
            {...({
              variant: "link",
              className: "h-auto max-w-full whitespace-normal text-left",
              onClick: () => {
                const key = `aiwrevolusi.account.${user.id}`;
                const copy = localStorage.getItem(key);
                if (copy) {
                  const url = URL.createObjectURL(
                    new Blob([copy], { type: "application/json" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "unsynced-workspace.json";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
                localStorage.removeItem(key);
                setLoading(true);
                setError("");
                setAttempt((v) => v + 1);
              },
            } satisfies Partial<ComponentProps<typeof Button>>)}
          >
            Download local backup and reload saved account
          </Button>
        </div>
      )}
      {loading ? (
        <p className="p-8 text-sm text-muted-foreground" role="status">
          Restoring your session…
        </p>
      ) : (
        <div key={user?.id ?? "guest"}>{children}</div>
      )}
    </Context.Provider>
  );
}

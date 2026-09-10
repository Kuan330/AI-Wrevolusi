import { AccountContext as Context, type Account } from "./useAccount";
import { clearSelectedOccupation } from "@/pages/WorkProfile/userProfile";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/services/api";
import { authService } from "@/services/authService";
import {
  activateWorkspace,
  clearWorkspaceOnLogout,
  accountStorage,
  flushWorkspace,
  workspaceKeys,
  syncError,
} from "@/services/accountStorage";
import { Button } from "@/components/ui/button";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, refresh] = useState(0);
  const [attempt, setAttempt] = useState(0);
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
        let account: Account;
        try {
          account = await api.get<Account>("/account/me");
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e;
          await authService.refresh();
          account = await api.get<Account>("/account/me");
        }
        if (active) await load(account);
      } catch (e) {
        if (active) {
          activateWorkspace(null);
          setUser(null);
          if (!(e instanceof ApiError) || e.status !== 401)
            setError(
              "Account service is unavailable. You can still explore your work as a guest.",
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
    const account = await api.post<Account>(`/account/${mode}`, {
      username,
      password,
    });
    await load(account);
    setError("");
    if (importGuest) {
      if (mode === "register") {
        Object.entries(guest).forEach(([key, value]) =>
          accountStorage.setItem(key, value),
        );
      } else if (guest["aiwrevolusi.learningCentre"]) {
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
      {user && syncError && (
        <div
          role="alert"
          className="bg-rose-50 px-5 py-2 text-sm text-rose-900"
        >
          {syncError}{" "}
          <Button
            variant="link"
            onClick={() => void flushWorkspace().catch(() => {})}
          >
            Retry saving
          </Button>
          <Button
            variant="link"
            onClick={() => {
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
            }}
          >
            Export local changes and reload saved account
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

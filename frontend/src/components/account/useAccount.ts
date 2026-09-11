import { createContext, useContext } from "react";
export type Account = { id: string; username: string };
export type AccountContextValue = {
  user: Account | null;
  loading: boolean;
  error: string;
  authenticate: (
    mode: "login" | "register",
    username: string,
    password: string,
    importGuest: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => void;
};
export const AccountContext = createContext<AccountContextValue | null>(null);
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("AccountProvider missing");
  return value;
}

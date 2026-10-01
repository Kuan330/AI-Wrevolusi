import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AuthDialog } from "@/components/account/AuthDialog";
import { useAccount } from "@/components/account/useAccount";
import { ROUTES } from "@/constants/routes";

export default function StartWorkspaceButton({ children }: { children?: ReactNode }) {
  const { user } = useAccount();
  const [open, setOpen] = useState(false);
  if (user) return <Link className="btn btn-warm" to={ROUTES.dashboard}>{children ?? "Open my workspace →"}</Link>;
  return <>
    <button type="button" className="btn btn-warm" onClick={() => setOpen(true)}>{children ?? "Create a free account →"}</button>
    {open && <AuthDialog open onClose={() => setOpen(false)} initialMode="register" destination={ROUTES.dashboard} />}
  </>;
}

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AuthDialog } from "@/components/account/AuthDialog";
import { useAccount } from "@/components/account/useAccount";
import { ROUTES } from "@/constants/routes";
import { hasConfirmedAnalysis } from "@/features/work-profile/userProfile";

export default function StartWorkspaceButton({ children }: { children?: ReactNode }) {
  const { user } = useAccount();
  const [open, setOpen] = useState(false);
  if (user) {
    const destination = hasConfirmedAnalysis() ? ROUTES.dashboard : ROUTES.workProfile;
    return <Link className="btn btn-warm" to={destination}>{children ?? "Open my workspace →"}</Link>;
  }
  return <>
    <button type="button" className="btn btn-warm" onClick={() => setOpen(true)}>{children ?? "Create a free account →"}</button>
    {open && <AuthDialog open onClose={() => setOpen(false)} initialMode="register" destination={ROUTES.workProfile} />}
  </>;
}

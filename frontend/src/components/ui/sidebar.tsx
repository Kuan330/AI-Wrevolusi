import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/** Shared navigation shell: desktop rail and focus-trapped mobile drawer. */
export function Sidebar({ children, collapsed, mobileOpen, onMobileOpenChange }: {
  children: ReactNode; collapsed: boolean; mobileOpen: boolean; onMobileOpenChange: (open: boolean) => void;
}) {
  return <>
    <aside className={cn("workspace-sidebar", collapsed && "is-collapsed")} aria-label="Workspace navigation">{children}</aside>
    <Dialog open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <DialogContent className="workspace-mobile-sidebar" overlayClassName="bg-slate-950/30">
        <DialogTitle className="sr-only">Workspace menu</DialogTitle>
        <DialogDescription className="sr-only">Navigate your work, skills and learning.</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  </>;
}

export function SidebarItem({ to, label, icon, collapsed, active, onNavigate }: {
  to: string; label: string; icon: ReactNode; collapsed: boolean; active: boolean; onNavigate: () => void;
}) {
  return <Link to={to} className={cn("workspace-nav-item", active && "is-active")}
    aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} onClick={onNavigate}>
    <span className="workspace-nav-icon" aria-hidden="true">{icon}</span>
    <span className="workspace-nav-label">{label}</span>
  </Link>;
}

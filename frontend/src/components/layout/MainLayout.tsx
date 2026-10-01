import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, ChevronRight } from "lucide-react";
import { localPreferences } from "@/infrastructure/storage/localPreferences";
import AppSidebar from "./AppSidebar";
import AccountMenu from "@/components/account/AccountMenu";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { pageLabel } from "@/constants/menu";
import "@/pages/WorkProfile/workProfile.css";
import "./workspace.css";

export default function MainLayout() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => localPreferences.getItem("aiwrevolusi.sidebar.collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => { document.title = `${pageLabel(pathname)} · AI-Wrevolusi`; window.scrollTo(0, 0); main.current?.focus({ preventScroll: true }); }, [pathname]);
  const learning = [ROUTES.learningGoals, ROUTES.plan, ROUTES.learningCentre].some(path => path === pathname);
  const history = pathname.startsWith(ROUTES.progress);
  const tabs = learning ? [[ROUTES.learningGoals, "Goals & activities"], [ROUTES.plan, "My courses"], [ROUTES.learningCentre, "Find courses"]] : history ? [[ROUTES.progress, "Learning records"], [ROUTES.progressReviews, "Progress reviews"]] : [];
  return <div className={`workspace-shell${collapsed ? " sidebar-collapsed" : ""}`}>
    <a href="#workspace-content" className="workspace-skip">Skip to content</a>
    <AppSidebar collapsed={collapsed} onToggle={() => { localPreferences.setItem("aiwrevolusi.sidebar.collapsed", String(!collapsed)); setCollapsed(!collapsed); }} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
    <div className="workspace-body">
      <header className="workspace-topbar"><div className="flex min-w-0 items-center gap-3"><Button size="icon" variant="ghost" className="workspace-mobile-trigger" aria-label="Open menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={22} /></Button><Link to={ROUTES.dashboard} className="workspace-breadcrumb-home">My workspace</Link><ChevronRight size={14} aria-hidden="true" /><span className="truncate">{pageLabel(pathname)}</span></div><AccountMenu /></header>
      <main id="workspace-content" ref={main} tabIndex={-1} className="workspace-content">
        {tabs.length > 0 && <nav className="workspace-page-tabs" aria-label={learning ? "Learning plan sections" : "Learning history sections"}>{tabs.map(([path, label]) => <Link key={path} to={path} aria-current={pathname === path ? "page" : undefined}>{label}</Link>)}</nav>}
        <Outlet />
      </main>
      <footer className="workspace-footer">Your work. Your skills. Your next step.</footer>
    </div>
  </div>;
}

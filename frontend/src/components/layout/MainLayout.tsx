import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, ChevronRight } from "lucide-react";
import { localPreferences } from "@/infrastructure/storage/localPreferences";
import AppSidebar from "./AppSidebar";
import { WorkspacePresentation } from "./WorkspacePresentation";
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
  const main = useRef<HTMLElement>(null), shell = useRef<HTMLDivElement>(null);
  const [topOffset, setTopOffset] = useState(0);
  const [editorRequested, setEditorRequested] = useState(false);
  const editorActive = pathname === ROUTES.resumeBuilder && editorRequested;
  const setEditorActive = useCallback((active: boolean) => { setEditorRequested(active); setMobileOpen(false); }, []);
  useEffect(() => {
    if (!editorActive) return;
    // Account/sync alerts remain above the workspace, including DB failures.
    // Fit the editor beneath them rather than creating a second page scrollbar.
    const measure = () => setTopOffset(Math.max(0, (shell.current?.getBoundingClientRect().top ?? 0) + window.scrollY));
    window.scrollTo(0, 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.getElementById("root") ?? document.body);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [editorActive]);
  const toggleMenu = useCallback(() => setMobileOpen(value => !value), []);
  const presentation = useMemo(() => ({ setEditorActive, toggleMenu, menuOpen: mobileOpen }), [setEditorActive, toggleMenu, mobileOpen]);
  useEffect(() => { document.title = `${pageLabel(pathname)} · AI-Wrevolusi`; window.scrollTo(0, 0); main.current?.focus({ preventScroll: true }); }, [pathname]);
  const learning = [ROUTES.learningGoals, ROUTES.plan, ROUTES.learningCentre].some(path => path === pathname);
  const tabs = learning ? [[ROUTES.learningGoals, "Goals & activities"], [ROUTES.plan, "My courses"], [ROUTES.learningCentre, "Find courses"]] : [];
  return <WorkspacePresentation.Provider value={presentation}><div ref={shell} style={{ "--workspace-top-offset": `${topOffset}px` } as React.CSSProperties} className={`workspace-shell${collapsed ? " sidebar-collapsed" : ""}${editorActive ? " workspace-editor-focus" : ""}`}>
    <a href="#workspace-content" className="workspace-skip">Skip to content</a>
    <AppSidebar collapsed={editorActive ? false : collapsed} onToggle={() => { if (editorActive) { toggleMenu(); return; } localPreferences.setItem("aiwrevolusi.sidebar.collapsed", String(!collapsed)); setCollapsed(!collapsed); }} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
    <div className="workspace-body">
      <header className="workspace-topbar"><div className="flex min-w-0 items-center gap-3"><Button size="icon" variant="ghost" className="workspace-mobile-trigger" aria-label="Open menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={22} /></Button><Link to={ROUTES.dashboard} className="workspace-breadcrumb-home">My workspace</Link><ChevronRight size={14} aria-hidden="true" /><span className="truncate">{pageLabel(pathname)}</span></div><AccountMenu /></header>
      <main id="workspace-content" ref={main} tabIndex={-1} className="workspace-content">
        {tabs.length > 0 && <nav className="workspace-page-tabs" aria-label="Learning plan sections">{tabs.map(([path, label]) => <Link key={path} to={path} aria-current={pathname === path ? "page" : undefined}>{label}</Link>)}</nav>}
        <Outlet />
      </main>
      <footer className="workspace-footer">Your work. Your skills. Your next step.</footer>
    </div>
  </div></WorkspacePresentation.Provider>;
}

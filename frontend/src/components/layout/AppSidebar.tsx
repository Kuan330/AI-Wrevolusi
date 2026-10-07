import { useState } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen, BriefcaseBusiness, ChartNoAxesCombined, Compass, FileText, History, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Sprout } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Sidebar, SidebarItem } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import Logo from "@/components/common/Logo";
import AccountMenu from "@/components/account/AccountMenu";
import { useAccount } from "@/components/account/useAccount";
import { SIDEBAR_GROUPS, COLLAPSIBLE_MENU_KEYS, filterSidebarGroups, isNavigationItemActive, navigationPath } from "@/constants/menu";

const icons = { dashboard: ChartNoAxesCombined, work: BriefcaseBusiness, ai: Sparkles, skills: Sprout, plan: BookOpen, history: History, career: Compass, resume: FileText };
export default function AppSidebar({ collapsed, onToggle, mobileOpen, onMobileOpenChange }: {
  collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileOpenChange: (open: boolean) => void;
}) {
  const { pathname } = useLocation();
  const { user } = useAccount();
  const [query, setQuery] = useState("");
  const path = navigationPath(pathname);
  const groups = filterSidebarGroups(query);
  const [menuState,setMenuState] = useState({ path, expanded: [...COLLAPSIBLE_MENU_KEYS] });
  const activeGroup = SIDEBAR_GROUPS.find(group => group.items.some(item => isNavigationItemActive(path, item)));
  const expanded = query.trim() ? [...COLLAPSIBLE_MENU_KEYS] : menuState.path === path ? menuState.expanded : [...new Set([...menuState.expanded,...(activeGroup?.collapsible ? [activeGroup.key] : [])])];
  const iconOnly = collapsed && !mobileOpen;

  return <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onMobileOpenChange={onMobileOpenChange}>
    <div className="workspace-brand"><Logo showWordmark={!collapsed || mobileOpen} /><Button size="icon" variant="ghost" className="workspace-collapse" aria-label={collapsed ? "Expand menu" : "Collapse menu"} onClick={() => { setQuery(""); onToggle(); }}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</Button></div>
    <div className="workspace-menu-search"><Search size={16} aria-hidden="true" /><input aria-label="Search menu" placeholder="Find a page…" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <nav className="workspace-navigation" aria-label="Main menu">
      <Accordion type="multiple" value={expanded} onValueChange={value => setMenuState({ path, expanded: value })}>
      {groups.map(group => {
        if (!group.items.length) return null;
        const items = group.items.map(item => {
          const Icon = icons[item.icon];
          const active = isNavigationItemActive(path, item);
          return <SidebarItem key={item.path} to={item.path} label={item.label} icon={<Icon size={19} />} collapsed={iconOnly} active={active} onNavigate={() => { onMobileOpenChange(false); setQuery(""); }} />;
        });
        if (!group.collapsible) return <div key={group.key} className="workspace-root-items">{items}</div>;
        const GroupIcon = icons[group.icon];
        if (iconOnly) return <Button key={group.key} variant="ghost" className={`workspace-group-icon${activeGroup?.key === group.key ? " is-active" : ""}`} aria-label={`Expand ${group.label} menu`} title={group.label} onClick={() => { onToggle(); setMenuState({ path, expanded: [...new Set([...expanded,group.key])] }); }}><GroupIcon size={19} /></Button>;
        return <AccordionItem key={group.key} value={group.key} className="workspace-nav-parent">
          <AccordionTrigger className={`workspace-parent-trigger${activeGroup?.key === group.key ? " has-active-child" : ""}`}><span><GroupIcon size={19} aria-hidden="true" />{group.label}</span></AccordionTrigger>
          <AccordionContent className="workspace-nav-children">{items}</AccordionContent>
        </AccordionItem>;
      })}
      </Accordion>
      {!groups.some(group => group.items.length) && <p className="p-3 text-sm" role="status">No pages found. Try “skills” or “learning”.</p>}
    </nav>
    <div className="workspace-sidebar-note"><Sprout size={22} /><strong>A little progress, every day.</strong><p>Build on the work you already do.</p></div>
    <div className="workspace-sidebar-account"><AccountMenu iconOnly /><div className="workspace-account-label"><strong>{user?.username ?? "Your workspace"}</strong><span>{user ? "Your personal learning journey" : "Sign in to save your progress"}</span></div></div>
  </Sidebar>;
}

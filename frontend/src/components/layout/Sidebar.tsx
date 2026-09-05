import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, CheckSquare2, Compass, Sparkles } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { SIDEBAR_MENU } from "@/constants/menu";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

const MENU_ICONS: Record<string, LucideIcon> = {
  "work-profile": BriefcaseBusiness,
  tasks: CheckSquare2,
  "ai-exposure": Sparkles,
  skills: Compass,
};

const itemIsActive = (path: string, pathname: string, hash: string) => {
  const [base, itemHash] = path.split("#");
  if (itemHash) {
    return pathname === base && hash === `#${itemHash}`;
  }
  return pathname === path;
};

const Sidebar = () => {
  const { pathname, hash } = useLocation();

  return (
    <aside
      className="fixed inset-y-0 left-0 top-16 z-20 hidden h-[calc(100vh-4rem)] w-72 overflow-y-auto border-r border-white/70 p-4 shadow-[8px_0_28px_rgba(61,43,54,0.06)] lg:block"
      style={{ background: PAGE_GRADIENT_CSS }}
    >
      <div className="mb-5 px-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f7280]">
            Iteration flow
          </p>
          <p className="mt-1 text-sm font-semibold text-[#2f2430]">Explore your work</p>
        </div>
      </div>
      <nav className="space-y-2" aria-label="Iteration flow">
        {SIDEBAR_MENU.map((item) => {
          const active = itemIsActive(item.path, pathname, hash);
          const Icon = MENU_ICONS[item.key] ?? Compass;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={`group relative block rounded-2xl border p-3.5 text-sm transition-all duration-200 ${
                active
                  ? "border-[#a9cde6] bg-white/70 text-[#2f5f80] shadow-[0_8px_22px_rgba(79,145,186,0.14)]"
                  : "border-white/50 bg-white/25 text-[#574a55] hover:border-[#b9d9ec] hover:bg-[#d6eaf7] hover:text-[#2f5f80]"
              }`}
            >
              {active ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#4f91ba]" /> : null}
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#eaf3fb] text-[#4f91ba]" : "bg-white/60 text-[#7f7280] group-hover:bg-white/80 group-hover:text-[#4f91ba]"}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#7f7280]">{item.description}</span>
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-6 rounded-2xl border border-white/65 bg-white/40 p-3.5 text-xs leading-5 text-[#574a55]">
        <p className="font-semibold text-[#3d5f7a]">Your progress</p>
        <p className="mt-1">Choose an occupation, confirm your tasks, then review AI exposure and skills.</p>
      </div>
    </aside>
  );
};

export default Sidebar;

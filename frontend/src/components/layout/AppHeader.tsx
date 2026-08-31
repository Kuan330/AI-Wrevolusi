import { NavLink } from "react-router-dom";
import { User } from "lucide-react";

import Logo from "@/components/common/Logo";
import { ROUTES } from "@/constants/routes";
import { hasConfirmedAnalysis } from "@/pages/Dashboard/analysisSession";
import { cn } from "@/lib/utils";

const AppHeader = () => {
  const showAiImpact = hasConfirmedAnalysis();

  const navItems = [
    { to: ROUTES.task, label: "Your tasks" },
    ...(showAiImpact ? [{ to: ROUTES.dashboard, label: "AI impact" }] : []),
  ];

  return (
    <header className="app-header sticky top-0 z-30 shrink-0 border-b border-white/70 bg-white/45 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-8">
          <Logo showWordmark />
          <nav className="app-header-nav" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn("app-header-nav__link", isActive && "is-active")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <button
          type="button"
          aria-label="Account"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/70 text-[#7f7280]"
        >
          <User className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;

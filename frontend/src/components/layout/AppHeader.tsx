import type { ComponentProps } from "react";
import { NavLink, useLocation, useMatch } from "react-router-dom";
import AccountMenu from "@/components/account/AccountMenu";
import { useAccount } from "@/components/account/useAccount";
import {
  hasConfirmedAnalysis,
  readTaskWorkspace,
} from "@/pages/WorkProfile/userProfile";

import Logo from "@/components/common/Logo";
import MobileMenu from "@/components/layout/MobileMenu";
import { PRIMARY_NAV_MENU } from "@/constants/menu";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const AppHeader = () => {
  const location = useLocation();
  const isOccupationPage = useMatch({ path: ROUTES.workProfile, end: true });
  const isTasksPage = useMatch({ path: ROUTES.task, end: true });
  const { user } = useAccount();
  const confirmed = hasConfirmedAnalysis();
  const hasTasks = Boolean(readTaskWorkspace()?.tasksOccupationCode);
  const navigationItems = PRIMARY_NAV_MENU.filter((item) => {
    const setup = item.path === ROUTES.workProfile || item.path === ROUTES.task;
    if (isOccupationPage) return item.path === ROUTES.workProfile;
    if (isTasksPage || (user && !confirmed && hasTasks)) return setup;
    if (user && !confirmed) return item.path === ROUTES.workProfile;
    if (user && confirmed) return !setup;
    return true;
  });
  return (
    <header className="app-header sticky top-0 z-30 shrink-0 border-b border-white/70 bg-white/45 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3 lg:gap-8">
          <MobileMenu items={navigationItems} />
          <Logo showWordmark />
          <nav className="app-header-nav hidden lg:flex" aria-label="Primary">
            {navigationItems.map((item) => (
              <NavLink
                key={item.key}
                {...({
                  to: item.path,
                  state:
                    item.path === ROUTES.workProfile &&
                    location.pathname !== ROUTES.workProfile
                      ? { returnTo: location.pathname + location.search }
                      : location.state,
                  end: item.path === ROUTES.workProfile,
                  className: ({ isActive }) =>
                    cn("app-header-nav__link", isActive && "is-active"),
                } satisfies Partial<ComponentProps<typeof NavLink>>)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <AccountMenu />
      </div>
    </header>
  );
};

export default AppHeader;

import MobileMenu from "@/components/layout/MobileMenu";
import Logo from "@/components/common/Logo";
import { PRIMARY_NAV_MENU } from "@/constants/menu";
import { ROUTES } from "@/constants/routes";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const Navbar = () => {
  return (
    <header
      className="sticky top-0 z-30 border-b border-white/70 backdrop-blur-xl"
      style={{ background: PAGE_GRADIENT_CSS }}
    >
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3 lg:gap-8">
          <MobileMenu />
          <Logo showWordmark />
          <nav className="app-header-nav" aria-label="Primary">
            {PRIMARY_NAV_MENU.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === ROUTES.workProfile}
                className={({ isActive }) =>
                  cn("app-header-nav__link", isActive && "is-active")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

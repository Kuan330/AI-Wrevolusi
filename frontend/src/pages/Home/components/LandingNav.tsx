import type { ComponentProps } from "react";
import AccountMenu from "@/components/account/AccountMenu";
import { useAccount } from "@/components/account/useAccount";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

import Logo from "@/components/common/Logo";
import { ROUTES } from "@/constants/routes";

import { NAV_LINKS } from "./homeData";

const LandingNav = () => {
  const { user } = useAccount();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkProps1 = {
    to: user ? ROUTES.aiExposure : ROUTES.workProfile,
    className: "btn btn-primary btn-sm",
    style: { color: "#fff" },
  } satisfies Partial<ComponentProps<typeof Link>>;
  const linkProps2 = {
    to: user ? ROUTES.aiExposure : ROUTES.workProfile,
    className: "btn btn-primary btn-sm",
    style: { color: "#fff", alignSelf: "flex-start" },
  } satisfies Partial<ComponentProps<typeof Link>>;
  return (
    <nav className="landing-nav">
      <div className="nav-inner">
        <Logo />
        <div className="nav-links">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <Link {...linkProps1}>Start free analysis</Link>
          <AccountMenu iconOnly />
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className={`mobile-panel container ${mobileOpen ? "open" : ""}`}>
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <Link {...linkProps2}>Start free analysis</Link>
        <AccountMenu iconOnly />
      </div>
    </nav>
  );
};

export default LandingNav;

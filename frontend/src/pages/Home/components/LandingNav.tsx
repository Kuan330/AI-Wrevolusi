import AccountMenu from "@/components/account/AccountMenu";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import Logo from "@/components/common/Logo";
import StartWorkspaceButton from "./StartWorkspaceButton";

import { NAV_LINKS } from "./homeData";

const LandingNav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <StartWorkspaceButton />
          <AccountMenu />
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
        <StartWorkspaceButton />
        <AccountMenu />
      </div>
    </nav>
  );
};

export default LandingNav;

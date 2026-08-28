import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import MobileMenu from "@/components/layout/MobileMenu";
import Logo from "@/components/common/Logo";
import { SIDEBAR_MENU } from "@/constants/menu";
import { Badge } from "@/components/ui/badge";

const Navbar = () => {
  const location = useLocation();

  const currentLabel = useMemo(() => {
    return (
      SIDEBAR_MENU.find((item) => item.path === location.pathname)?.label ??
      "AI-Wrevolusi"
    );
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <MobileMenu />
          <Logo />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Badge variant="outline">Christine · Sales Supervisor</Badge>
          <Badge>{currentLabel}</Badge>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

import { Outlet, useLocation } from "react-router-dom";

import Logo from "@/components/common/Logo";
import { ROUTES } from "@/constants/routes";

const ProfileLayout = () => {
  const { pathname } = useLocation();
  const wide = pathname === ROUTES.dashboard;
  const width = wide ? "max-w-6xl" : "max-w-3xl";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className={`mx-auto flex h-16 items-center justify-between px-4 ${width} lg:px-0`}>
          <Logo showWordmark />
          <span className="text-sm font-medium text-muted-foreground">Your profile</span>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${width} lg:px-0 lg:py-10`}>
        <Outlet />
      </main>
    </div>
  );
};

export default ProfileLayout;

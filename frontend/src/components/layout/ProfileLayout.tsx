import { Outlet } from "react-router-dom";

import Logo from "@/components/common/Logo";

const ProfileLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 lg:px-0">
          <Logo showWordmark />
          <span className="text-sm font-medium text-muted-foreground">Your profile</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 lg:px-0 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
};

export default ProfileLayout;

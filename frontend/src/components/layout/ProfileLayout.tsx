import { Outlet, useLocation } from "react-router-dom";

import Logo from "@/components/common/Logo";
import { ROUTES } from "@/constants/routes";

const ProfileLayout = () => {
  const location = useLocation();
  const isWorkProfilePage = location.pathname === ROUTES.workProfile;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(90deg, #eaf3fb 0%, #f5f3f8 48%, #f8ecef 100%)",
      }}
    >
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/45 backdrop-blur-xl">
        <div
          className={`mx-auto flex h-16 items-center justify-between px-4 lg:px-0 ${
            isWorkProfilePage ? "max-w-6xl" : "max-w-3xl"
          }`}
        >
          <Logo showWordmark />
          <span className="text-sm font-medium text-muted-foreground">Your profile</span>
        </div>
      </header>
      <main
        className={`mx-auto px-4 py-6 lg:px-0 lg:py-10 ${
          isWorkProfilePage ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default ProfileLayout;

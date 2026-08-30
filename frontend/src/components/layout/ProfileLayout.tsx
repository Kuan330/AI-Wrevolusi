import { Outlet, useLocation } from "react-router-dom";

import AppHeader from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import "@/pages/WorkProfile/workProfile.css";

const ProfileLayout = () => {
  const { pathname } = useLocation();
  const wide = pathname === ROUTES.dashboard;

  return (
    <div
      className="work-profile-page min-h-screen"
      style={{
        background: "linear-gradient(90deg, #eaf3fb 0%, #f5f3f8 48%, #f8ecef 100%)",
      }}
    >
      <AppHeader />
      <main
        className={`mx-auto px-4 lg:px-6 ${
          wide ? "max-w-[1440px] py-4 lg:py-5" : "max-w-2xl py-6 lg:px-0 lg:py-10"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default ProfileLayout;

import { Outlet, useLocation } from "react-router-dom";

import AppHeader from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import "@/pages/WorkProfile/workProfile.css";

const ProfileLayout = () => {
  const { pathname } = useLocation();
  const isTasksPage = pathname === ROUTES.task;
  const lockViewport = isTasksPage;

  return (
    <div
      className={`work-profile-page ${
        lockViewport ? "flex h-screen flex-col overflow-hidden" : "min-h-screen"
      }`}
      style={{
        background: "linear-gradient(90deg, #eaf3fb 0%, #f5f3f8 48%, #f8ecef 100%)",
      }}
    >
      <AppHeader />
      <main
        className={`mx-auto flex w-full min-h-0 flex-1 flex-col px-4 lg:px-6 ${
          isTasksPage
              ? "max-w-2xl py-4 lg:px-0 lg:py-5"
              : "max-w-2xl py-6 lg:px-0 lg:py-10"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default ProfileLayout;

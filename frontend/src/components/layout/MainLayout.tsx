import { Outlet } from "react-router-dom";

import Navbar from "@/components/layout/Navbar";
import JourneyNavigation from "@/components/layout/JourneyNavigation";
import { PAGE_GRADIENT_CSS } from "@/constants/palette";

const MainLayout = () => {
  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      style={{ background: PAGE_GRADIENT_CSS }}
    >
      <Navbar />
      <JourneyNavigation />
      <div className="flex-1">
        <main className="min-w-0 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

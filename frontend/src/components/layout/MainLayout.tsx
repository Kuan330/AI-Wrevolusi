import { Outlet } from "react-router-dom";

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-background" style={{ background: PAGE_GRADIENT_CSS }}>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <main className="min-w-0 p-4 lg:ml-72 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import { STEPS } from "./constants";
import { HomePage } from "./pages/HomePage";
import { MatchPage } from "./pages/MatchPage";
import { TasksPage } from "./pages/TasksPage";
import { ChangesPage } from "./pages/ChangesPage";
import { ExposurePage } from "./pages/ExposurePage";
import { SkillsPage } from "./pages/SkillsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { BridgePage } from "./pages/BridgePage";

function pageId(pathname) {
  return STEPS.find((s) => s.path === pathname)?.id || "home";
}

export default function App() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  useEffect(() => {
    document.body.dataset.page = pageId(pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return (
    <>
      <SiteHeader />
      <main className={isHome ? "home-main" : undefined}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/exposure" element={<ExposurePage />} />
          <Route path="/changes" element={<ChangesPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/next" element={<BridgePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

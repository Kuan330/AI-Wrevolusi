import { BrowserRouter, Route, Routes } from "react-router-dom";

import MainLayout from "@/components/layout/MainLayout";
import { ROUTES } from "@/constants/routes";
import AIExposure from "@/pages/AIExposure/AIExposure";
import Capabilities from "@/pages/Capabilities/Capabilities";
import Dashboard from "@/pages/Dashboard/Dashboard";
import Flexibility from "@/pages/Flexibility/Flexibility";
import Home from "@/pages/Home/Home";
import Interpretation from "@/pages/Interpretation/Interpretation";
import Preparation from "@/pages/Preparation/Preparation";
import Priorities from "@/pages/Priorities/Priorities";
import TaskEfficiency from "@/pages/TaskEfficiency/TaskEfficiency";
import WorkProfile from "@/pages/WorkProfile/WorkProfile";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.home} element={<Home />} />
        <Route element={<MainLayout />}>
          <Route path={ROUTES.dashboard} element={<Dashboard />} />
          <Route path={ROUTES.workProfile} element={<WorkProfile />} />
          <Route path={ROUTES.aiExposure} element={<AIExposure />} />
          <Route path={ROUTES.capabilities} element={<Capabilities />} />
          <Route path={ROUTES.interpretation} element={<Interpretation />} />
          <Route path={ROUTES.priorities} element={<Priorities />} />
          <Route path={ROUTES.preparation} element={<Preparation />} />
          <Route path={ROUTES.flexibility} element={<Flexibility />} />
          <Route path={ROUTES.taskEfficiency} element={<TaskEfficiency />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;

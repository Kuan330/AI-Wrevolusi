import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "@/components/layout/MainLayout";
import ProfileLayout from "@/components/layout/ProfileLayout";
import { ROUTES } from "@/constants/routes";
import Dashboard from "@/pages/Dashboard/Dashboard";
import Flexibility from "@/pages/Flexibility/Flexibility";
import Home from "@/pages/Home/Home";
import Interpretation from "@/pages/Interpretation/Interpretation";
import Preparation from "@/pages/Preparation/Preparation";
import Priorities from "@/pages/Priorities/Priorities";
import TaskEfficiency from "@/pages/TaskEfficiency/TaskEfficiency";
import WorkProfile from "@/pages/WorkProfile/WorkProfile";
import ProfileTasks from "@/pages/WorkProfile/ProfileTasks";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.home} element={<Home />} />
        <Route element={<ProfileLayout />}>
          <Route path={ROUTES.workProfile} element={<WorkProfile />} />
          <Route path={ROUTES.task} element={<ProfileTasks />} />
          <Route path={ROUTES.dashboard} element={<Dashboard />} />
        </Route>
        <Route path="/work-profile" element={<Navigate to={ROUTES.workProfile} replace />} />
        <Route path={ROUTES.aiExposure} element={<Navigate to={`${ROUTES.dashboard}#exposure`} replace />} />
        <Route path={ROUTES.capabilities} element={<Navigate to={`${ROUTES.dashboard}#capabilities`} replace />} />
        <Route element={<MainLayout />}>
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

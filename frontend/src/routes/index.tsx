import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "@/components/layout/MainLayout";
import ProfileLayout from "@/components/layout/ProfileLayout";
import RequireConfirmedAnalysis from "@/components/layout/RequireConfirmedAnalysis";
import { ROUTES } from "@/constants/routes";
import AIExposure from "@/pages/AIExposure/AIExposure";
import Home from "@/pages/Home/Home";
import LearningCentre from "@/pages/LearningCentre/LearningCentre";
import Possibilities from "@/pages/Possibilities/Possibilities";
import Plan from "@/pages/Plan/Plan";
import Skills from "@/pages/Skills/Skills";
import SystemDesign from "@/pages/SystemDesign/SystemDesign";
import WorkProfile from "@/pages/WorkProfile/WorkProfile";
import ProfileTasks from "@/pages/WorkProfile/ProfileTasks";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.home} element={<Home />} />
        <Route path={ROUTES.systemDesign} element={<SystemDesign />} />
        <Route element={<ProfileLayout />}>
          <Route path={ROUTES.workProfile} element={<WorkProfile />} />
          <Route path={ROUTES.task} element={<ProfileTasks />} />
        </Route>
        <Route path="/work-profile" element={<Navigate to={ROUTES.workProfile} replace />} />
        <Route element={<MainLayout />}>
          <Route element={<RequireConfirmedAnalysis />}>
            <Route path={ROUTES.aiExposure} element={<AIExposure />} />
            <Route path={ROUTES.skills} element={<Skills />} />
            <Route path={ROUTES.possibilities} element={<Possibilities />} />
            <Route path={ROUTES.plan} element={<Plan />} />
            <Route path={ROUTES.learningCentre} element={<LearningCentre />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;

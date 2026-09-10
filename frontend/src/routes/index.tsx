import { useAccount } from "@/components/account/useAccount";
import AccountGate from "@/components/account/AccountGate";
import { AccountProvider } from "@/components/account/AccountProvider";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

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
import WorkProfile from "@/pages/WorkProfile/WorkProfile";
import ProfileTasks from "@/pages/WorkProfile/ProfileTasks";

const HomeRoute = () => {
  const { user } = useAccount();
  const location = useLocation();
  return user && !location.state?.showHome
    ? <Navigate to={ROUTES.aiExposure} replace />
    : <Home />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AccountProvider>
        <Routes>
          <Route path={ROUTES.home} element={<HomeRoute />} />
          <Route element={<ProfileLayout />}>
            <Route path={ROUTES.workProfile} element={<WorkProfile />} />
            <Route path={ROUTES.task} element={<ProfileTasks />} />
          </Route>
          <Route
            path="/work-profile"
            element={<Navigate to={ROUTES.workProfile} replace />}
          />
          <Route element={<MainLayout />}>
            <Route element={<RequireConfirmedAnalysis />}>
              <Route path={ROUTES.aiExposure} element={<AIExposure />} />
              <Route path={ROUTES.skills} element={<Skills />} />
            </Route>
            <Route
              path={ROUTES.learningCentre}
              element={
                <AccountGate kind="resources">
                  <LearningCentre />
                </AccountGate>
              }
            />
            <Route
              path={ROUTES.plan}
              element={
                <AccountGate kind="plan">
                  <Plan />
                </AccountGate>
              }
            />
            <Route
              path={ROUTES.possibilities}
              element={
                <AccountGate kind="possibilities">
                  <Possibilities />
                </AccountGate>
              }
            />
          </Route>
        </Routes>
      </AccountProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;

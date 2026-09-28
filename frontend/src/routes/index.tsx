import type { ComponentProps } from "react";
import { useAccount } from "@/components/account/useAccount";
import AccountGate from "@/components/account/AccountGate";
import { AccountProvider } from "@/components/account/AccountProvider";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import ContinueJourney from "@/pages/Journey/ContinueJourney";
import SkillsReview from "@/pages/Skills/SkillsReview";
import RequireWorkTasks from "@/components/layout/RequireWorkTasks";
import MainLayout from "@/components/layout/MainLayout";
import ProfileLayout from "@/components/layout/ProfileLayout";
import RequireConfirmedAnalysis from "@/components/layout/RequireConfirmedAnalysis";
import { ROUTES } from "@/constants/routes";
import AIExposure from "@/pages/AIExposure/AIExposure";
import Home from "@/pages/Home/Home";
import LearningCentre from "@/pages/LearningCentre/LearningCentre";
import Possibilities from "@/pages/Possibilities/Possibilities";
import Plan from "@/pages/Plan/Plan";
import WorkProfile from "@/pages/WorkProfile/WorkProfile";
import ProfileTasks from "@/pages/WorkProfile/ProfileTasks";

const HomeRoute = () => {
  const { user } = useAccount();
  const location = useLocation();
  return user && !location.state?.showHome ? (
    <Navigate
      {...({ to: ROUTES.continue, replace: true } satisfies Partial<
        ComponentProps<typeof Navigate>
      >)}
    />
  ) : (
    <Home />
  );
};

const AppRoutes = () => {
  const navigateProps1 = {
    to: ROUTES.workProfile,
    replace: true,
  } satisfies Partial<ComponentProps<typeof Navigate>>;
  return (
    <BrowserRouter>
      <AccountProvider>
        <Routes>
          <Route path={ROUTES.home} element={<HomeRoute />} />
          <Route element={<ProfileLayout />}>
            <Route path={ROUTES.workProfile} element={<AccountGate kind="work"><WorkProfile /></AccountGate>} />
            <Route path={ROUTES.task} element={<AccountGate kind="work"><ProfileTasks /></AccountGate>} />
          </Route>
          <Route
            path="/work-profile"
            element={<Navigate {...navigateProps1} />}
          />
          <Route element={<MainLayout />}>
            <Route path={ROUTES.continue} element={<AccountGate kind="plan"><ContinueJourney /></AccountGate>} />
            <Route element={<AccountGate kind="work"><Outlet /></AccountGate>}>
              <Route element={<RequireWorkTasks />}>
                <Route path={ROUTES.skills} element={<SkillsReview />} />
              </Route>
              <Route element={<RequireConfirmedAnalysis />}>
                <Route path={ROUTES.aiExposure} element={<AIExposure />} />
              </Route>
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

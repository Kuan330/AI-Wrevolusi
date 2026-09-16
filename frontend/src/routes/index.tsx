import type { ComponentProps } from "react";
import { lazy, Suspense } from "react";
import { useAccount } from "@/components/account/useAccount";
import AccountGate from "@/components/account/AccountGate";
import { AccountProvider } from "@/components/account/AccountProvider";
import Loading from "@/components/common/Loading";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import MainLayout from "@/components/layout/MainLayout";
import ProfileLayout from "@/components/layout/ProfileLayout";
import RequireConfirmedAnalysis from "@/components/layout/RequireConfirmedAnalysis";
import { ROUTES } from "@/constants/routes";

const AIExposure = lazy(() => import("@/pages/AIExposure/AIExposure"));
const Home = lazy(() => import("@/pages/Home/Home"));
const LearningCentre = lazy(
  () => import("@/pages/LearningCentre/LearningCentre"),
);
const Possibilities = lazy(() => import("@/pages/Possibilities/Possibilities"));
const Plan = lazy(() => import("@/pages/Plan/Plan"));
const Skills = lazy(() => import("@/pages/Skills/Skills"));
const WorkProfile = lazy(() => import("@/pages/WorkProfile/WorkProfile"));
const ProfileTasks = lazy(() => import("@/pages/WorkProfile/ProfileTasks"));

const HomeRoute = () => {
  const { user } = useAccount();
  const location = useLocation();
  return user && !location.state?.showHome ? (
    <Navigate
      {...({ to: ROUTES.aiExposure, replace: true } satisfies Partial<
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
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <Loading label="Loading page…" />
            </div>
          }
        >
          <Routes>
            <Route path={ROUTES.home} element={<HomeRoute />} />
            <Route element={<ProfileLayout />}>
              <Route path={ROUTES.workProfile} element={<WorkProfile />} />
              <Route path={ROUTES.task} element={<ProfileTasks />} />
            </Route>
            <Route
              path="/work-profile"
              element={<Navigate {...navigateProps1} />}
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
        </Suspense>
      </AccountProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;

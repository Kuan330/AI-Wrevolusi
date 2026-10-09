import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AccountGate from "@/components/account/AccountGate";
import { AccountProvider } from "@/components/account/AccountProvider";
import RequireWorkTasks from "@/components/layout/RequireWorkTasks";
import MainLayout from "@/components/layout/MainLayout";
import ContinueJourney from "@/pages/Journey/ContinueJourney";
import Home from "@/pages/Home/Home";
import Dashboard from "@/pages/Dashboard/Dashboard";
import SkillsReview from "@/pages/Skills/SkillsReview";
import AIExposure from "@/pages/AIExposure/AIExposure";
import LearningCentre from "@/pages/LearningCentre/LearningCentre";
import LearningGoals from "@/pages/LearningGoals/LearningGoals";
import LearningPlanOnboarding from "@/pages/LearningPlanOnboarding/LearningPlanOnboarding";
import LearningHistory from "@/pages/LearningHistory/LearningHistory";
import Progress from "@/pages/Progress/Progress";
const ResumeBuilder = lazy(() => import("@/pages/ResumeBuilder/ResumeBuilder"));
const InterviewPractice = lazy(() => import("@/pages/InterviewPractice/InterviewPractice"));
import Possibilities from "@/pages/Possibilities/Possibilities";
import Plan from "@/pages/Plan/Plan";
import WorkProfile from "@/pages/WorkProfile/WorkProfile";
import { LEGACY_ROUTES, ROUTES } from "@/constants/routes";

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate replace to={to + location.search + location.hash} state={location.state} />;
}
function NotFound() {
  return <section className="workspace-empty"><p className="dashboard-eyebrow">404</p><h1>We couldn’t find this page.</h1><p>Your saved work is still available.</p><Link to={ROUTES.dashboard}>Back to work overview →</Link></section>;
}
export default function AppRoutes() {
  return <BrowserRouter><AccountProvider><Routes>
    {Object.entries(LEGACY_ROUTES).map(([from, to]) => <Route key={from} path={from} element={<LegacyRedirect to={to} />} />)}
    <Route path={ROUTES.home} element={<Home />} />
    <Route element={<MainLayout />}>
      <Route path={ROUTES.dashboard} element={<AccountGate kind="work"><Dashboard /></AccountGate>} />
      <Route path={ROUTES.workProfile} element={<AccountGate kind="work"><WorkProfile /></AccountGate>} />
      <Route element={<AccountGate kind="work"><Outlet /></AccountGate>}><Route element={<RequireWorkTasks />}>
        <Route path={ROUTES.skills} element={<SkillsReview />} />
        <Route path={ROUTES.aiExposure} element={<AIExposure />} />
      </Route></Route>
      <Route path={ROUTES.learningGoals} element={<AccountGate kind="plan"><LearningPlanOnboarding><LearningGoals /></LearningPlanOnboarding></AccountGate>} />
      <Route path={ROUTES.plan} element={<AccountGate kind="plan"><Plan /></AccountGate>} />
      <Route path={ROUTES.learningCentre} element={<AccountGate kind="resources"><LearningCentre /></AccountGate>} />
      <Route path={ROUTES.progress} element={<AccountGate kind="plan"><LearningHistory /></AccountGate>} />
      <Route path={ROUTES.progressReviews} element={<AccountGate kind="plan"><Progress /></AccountGate>} />
      <Route path={ROUTES.possibilities} element={<AccountGate kind="possibilities"><Possibilities /></AccountGate>} />
      <Route path={ROUTES.resumeBuilder} element={<AccountGate kind="possibilities"><Suspense fallback={<p role="status" className="p-8">Loading resume editor…</p>}><ResumeBuilder /></Suspense></AccountGate>} />
      <Route path={ROUTES.interview} element={<AccountGate kind="possibilities"><Suspense fallback={<p role="status" className="p-8">Loading interview practice…</p>}><InterviewPractice /></Suspense></AccountGate>} />
      <Route path={ROUTES.continue} element={<AccountGate kind="plan"><ContinueJourney /></AccountGate>} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes></AccountProvider></BrowserRouter>;
}

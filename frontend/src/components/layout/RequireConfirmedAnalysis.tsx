import type { ComponentProps } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ROUTES } from "@/constants/routes";
import {
  hasConfirmedAnalysis,
  readTaskWorkspace,
} from "@/pages/WorkProfile/userProfile";

const RequireConfirmedAnalysis = () => {
  const location = useLocation();
  const demoParam = new URLSearchParams(location.search).get("demo");
  const isDevDemoPreview =
    import.meta.env.DEV &&
    (location.pathname === ROUTES.learningCentre ||
    location.pathname === ROUTES.plan
      ? demoParam !== "0"
      : location.pathname === ROUTES.possibilities && demoParam === "1");
  if (isDevDemoPreview) {
    return <Outlet />;
  }
  if (hasConfirmedAnalysis()) {
    return <Outlet />;
  }

  const taskWorkspace = readTaskWorkspace();
  if (taskWorkspace?.tasksOccupationCode && taskWorkspace.tasks.length > 0) {
    const navigateProps1 = {
      to: { pathname: ROUTES.task, search: "?reanalyze=1" },
      replace: true,
    } satisfies Partial<ComponentProps<typeof Navigate>>;
    return <Navigate {...navigateProps1} />;
  }

  const navigateProps2 = {
    to: ROUTES.workProfile,
    replace: true,
  } satisfies Partial<ComponentProps<typeof Navigate>>;
  return <Navigate {...navigateProps2} />;
};

export default RequireConfirmedAnalysis;

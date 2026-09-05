import { Navigate, Outlet } from "react-router-dom";

import { ROUTES } from "@/constants/routes";
import { hasConfirmedAnalysis, readTaskWorkspace } from "@/pages/WorkProfile/userProfile";

const RequireConfirmedAnalysis = () => {
  if (hasConfirmedAnalysis()) {
    return <Outlet />;
  }

  const taskWorkspace = readTaskWorkspace();
  if (taskWorkspace?.tasksOccupationCode && taskWorkspace.tasks.length > 0) {
    return (
      <Navigate
        to={{ pathname: ROUTES.task, search: "?reanalyze=1" }}
        replace
      />
    );
  }

  return (
    <Navigate
      to={ROUTES.workProfile}
      replace
    />
  );
};

export default RequireConfirmedAnalysis;

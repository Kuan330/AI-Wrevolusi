import { Navigate, Outlet } from "react-router-dom";

import { ROUTES } from "@/constants/routes";
import { hasConfirmedAnalysis } from "@/pages/Dashboard/analysisSession";
import { readSelectedOccupation } from "@/pages/WorkProfile/occupationSession";

const RequireConfirmedAnalysis = () => {
  if (hasConfirmedAnalysis()) {
    return <Outlet />;
  }

  return (
    <Navigate
      to={readSelectedOccupation() ? ROUTES.task : ROUTES.workProfile}
      replace
    />
  );
};

export default RequireConfirmedAnalysis;

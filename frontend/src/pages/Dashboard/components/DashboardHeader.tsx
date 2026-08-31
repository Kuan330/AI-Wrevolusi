import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const DashboardHeader = () => {
  return (
    <div className="dashboard-page__header">
      <h1 className="text-xl font-semibold leading-snug text-[#2f2430] sm:text-[1.35rem]">
        AI Impact on Your Role, Tasks and Skills
      </h1>
      <div className="dashboard-page__header-actions">
        <Button asChild className="profile-primary-btn h-9 whitespace-nowrap rounded-full px-4 text-sm">
          <Link to={ROUTES.workProfile}>Change occupation</Link>
        </Button>
        <Button asChild className="profile-gradient-btn inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm">
          <Link to={ROUTES.task} state={{ taskEntry: "dashboard" }} className="inline-flex items-center gap-2">
            <img src="/images/icons/icon-edit.svg" alt="" className="h-4 w-4" />
            Edit tasks
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;

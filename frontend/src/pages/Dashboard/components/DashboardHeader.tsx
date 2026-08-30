import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

const DashboardHeader = () => {
  return (
    <div className="dashboard-page__header">
      <h1 className="text-2xl font-semibold leading-snug text-[#2f2430]">
        AI Impact on Your Role, Tasks and Skills
      </h1>
      <div className="dashboard-page__header-actions">
        <Button asChild className="profile-primary-btn h-10 whitespace-nowrap rounded-full px-5">
          <Link to={ROUTES.workProfile}>Change occupation</Link>
        </Button>
        <Button asChild className="profile-gradient-btn inline-flex h-10 items-center whitespace-nowrap rounded-full px-4">
          <Link to={ROUTES.task} className="inline-flex items-center gap-2">
            <img src="/images/icons/icon-edit.svg" alt="" className="h-4 w-4" />
            Edit tasks
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;

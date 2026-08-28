import PageHeader from "@/components/common/PageHeader";
import ProgressCard from "@/pages/Dashboard/components/ProgressCard";
import RecentActivity from "@/pages/Dashboard/components/RecentActivity";

const Dashboard = () => {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Track progress across E1 to E8 for the prototype."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <ProgressCard title="Iteration 1 completion" value={66} />
        <ProgressCard title="Confirmed tasks" value={75} />
        <ProgressCard title="Capabilities reviewed" value={50} />
      </div>
      <div className="mt-4">
        <RecentActivity />
      </div>
    </div>
  );
};

export default Dashboard;

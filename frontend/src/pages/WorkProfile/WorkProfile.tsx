import PageHeader from "@/components/common/PageHeader";
import TaskList from "@/pages/WorkProfile/components/TaskList";

const WorkProfile = () => {
  return (
    <div>
      <PageHeader
        title="Work Profile (E1)"
        description="Capture real tasks and confirm what you actually do at work."
      />
      <TaskList />
    </div>
  );
};

export default WorkProfile;

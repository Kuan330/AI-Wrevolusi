import PageHeader from "@/components/common/PageHeader";
import OccupationJourney from "@/pages/WorkProfile/components/OccupationJourney";

const WorkProfile = () => {
  return (
    <div>
      <PageHeader
        title="Build your work profile"
        description="Choose the closest occupation, then keep only the tasks that reflect your real work."
      />
      <OccupationJourney />
    </div>
  );
};

export default WorkProfile;

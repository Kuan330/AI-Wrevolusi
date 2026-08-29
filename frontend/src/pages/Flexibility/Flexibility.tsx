import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FlexibilityChecklist from "@/pages/Flexibility/components/FlexibilityChecklist";

const Flexibility = () => {
  return (
    <div>
      <PageHeader
        title="Flexibility (E7)"
        description="Support pause/resume and adaptable pacing based on personal capacity."
      />
      <Card>
        <CardHeader>
          <CardTitle>Flexibility controls</CardTitle>
        </CardHeader>
        <CardContent>
          <FlexibilityChecklist />
        </CardContent>
      </Card>
    </div>
  );
};

export default Flexibility;

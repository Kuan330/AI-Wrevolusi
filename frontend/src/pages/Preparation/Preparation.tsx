import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import PreparationStepper from "@/pages/Preparation/components/PreparationStepper";

const Preparation = () => {
  return (
    <div>
      <PageHeader
        title="Preparation (E6)"
        description="Rank what to prepare first using confirmed E2 and E3 outputs."
      />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Plan progress</CardTitle>
          </CardHeader>
          <CardContent>
            <PreparationStepper />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Effort estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <Slider defaultValue={[3]} max={5} min={1} step={1} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Preparation;

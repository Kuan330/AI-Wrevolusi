import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import EfficiencyTimeline from "@/pages/TaskEfficiency/components/EfficiencyTimeline";

const TaskEfficiency = () => {
  return (
    <div>
      <PageHeader
        title="Task Efficiency (E8)"
        description="Track micro-level improvements without turning outcomes into readiness scores."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Efficiency gain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Current target task improvement</p>
            <Progress value={62} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <EfficiencyTimeline />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskEfficiency;

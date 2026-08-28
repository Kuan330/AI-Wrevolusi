import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Timeline from "@/components/ui/timeline";

const activityItems = [
  { id: "a1", title: "Work profile confirmed", detail: "3 tasks confirmed", time: "Today" },
  { id: "a2", title: "AI exposure refreshed", detail: "1 task changed to AI-assisted", time: "Yesterday" },
  { id: "a3", title: "Capability updated", detail: "Team coordination renamed", time: "2 days ago" },
];

const RecentActivity = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline items={activityItems} />
      </CardContent>
    </Card>
  );
};

export default RecentActivity;

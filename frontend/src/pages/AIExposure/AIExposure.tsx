import PageHeader from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExposureCard from "@/pages/AIExposure/components/ExposureCard";
import ExposureChart from "@/pages/AIExposure/components/ExposureChart";

const AIExposure = () => {
  return (
    <div>
      <PageHeader
        title="AI Exposure (E2)"
        description="Review how each confirmed task may change with AI support."
      />
      <Tabs defaultValue="cards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cards">Task cards</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="grid gap-3 md:grid-cols-2">
          <ExposureCard
            title="Oversee daily sales operations"
            state="Human-led"
            reason="Requires live judgement and team coordination in context."
          />
          <ExposureCard
            title="Prepare weekly sales report"
            state="Partly automated"
            reason="Data preparation is automated but validation remains human-led."
          />
        </TabsContent>
        <TabsContent value="chart">
          <ExposureChart />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIExposure;

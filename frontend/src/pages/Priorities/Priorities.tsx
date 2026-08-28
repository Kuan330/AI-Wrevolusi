import PageHeader from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PriorityTable from "@/pages/Priorities/components/PriorityTable";

const Priorities = () => {
  return (
    <div>
      <PageHeader
        title="Priorities (E5 optional)"
        description="Explore optional pathways before committing to preparation priorities."
      />
      <Tabs defaultValue="top">
        <TabsList>
          <TabsTrigger value="top">Top priorities</TabsTrigger>
          <TabsTrigger value="all">All candidates</TabsTrigger>
        </TabsList>
        <TabsContent value="top" className="mt-4 rounded-xl border border-border bg-card p-4">
          <PriorityTable />
        </TabsContent>
        <TabsContent value="all" className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Add additional pathway candidates from E5 matching logic.
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Priorities;

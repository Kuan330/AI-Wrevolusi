import { useEffect, useMemo, useState } from "react";

import EmptyState from "@/components/common/EmptyState";
import Loading from "@/components/common/Loading";
import PageHeader from "@/components/common/PageHeader";
import { MESSAGES } from "@/constants/messages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExposureCard from "@/pages/AIExposure/components/ExposureCard";
import ExposureChart from "@/pages/AIExposure/components/ExposureChart";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/api";
import { exposureService, type ExposureResult } from "@/services/exposureService";
import { taskService } from "@/services/taskService";
import type { ExposureState, Task } from "@/types/task";

interface ExposureView {
  taskId: string;
  title: string;
  state: ExposureState;
  reason: string;
  confidence: number;
}

const exposureLabelMap: Record<ExposureState, string> = {
  human_led: "Human-led",
  ai_assisted: "AI-assisted",
  partly_automated: "Partly automated",
  reshaped: "Reshaped",
  insufficient_data: "Insufficient data",
};
const chartStates = ["human_led", "ai_assisted", "partly_automated", "reshaped"] as const;

const AIExposure = () => {
  const [items, setItems] = useState<ExposureView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExposure = async () => {
      try {
        await authService.ensureDemoSession();
        const tasks = await taskService.list();
        const results = await Promise.all(
          tasks.map(async (task) => {
            try {
              const exposure = await exposureService.getByTaskId(task.id);
              return {
                task,
                exposure,
              };
            } catch {
              return {
                task,
                exposure: null,
              };
            }
          })
        );

        const views = results.map(({ task, exposure }) => mapToExposureView(task, exposure));
        setItems(views);
      } catch (error) {
        if (error instanceof ApiError) {
          setError(error.detail);
        } else {
          setError("Failed to load task exposure.");
        }
      } finally {
        setLoading(false);
      }
    };

    void loadExposure();
  }, []);

  const chartData = useMemo(
    () =>
      chartStates.map((state) => ({
        state,
        value: items.filter((item) => item.state === state).length,
      })),
    [items]
  );

  if (loading) {
    return <Loading label={MESSAGES.loading} />;
  }

  if (error) {
    return <EmptyState title="Exposure unavailable" message={error} />;
  }

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
          {items.length ? (
            items.map((item) => (
              <ExposureCard
                key={item.taskId}
                title={item.title}
                state={exposureLabelMap[item.state]}
                reason={item.reason}
                confidence={item.confidence}
              />
            ))
          ) : (
            <EmptyState title="No tasks found" message="Add tasks in E1 first to see E2 exposure." />
          )}
        </TabsContent>
        <TabsContent value="chart">
          <ExposureChart data={chartData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const mapToExposureView = (task: Task, exposure: ExposureResult | null): ExposureView => {
  if (exposure) {
    return {
      taskId: task.id,
      title: task.title,
      state: exposure.exposure_type,
      reason: exposure.reason,
      confidence: exposure.confidence,
    };
  }

  return {
    taskId: task.id,
    title: task.title,
    state: task.exposure ?? "insufficient_data",
    reason: "Using task-level fallback because explanation service is unavailable.",
    confidence: 0.4,
  };
};

export default AIExposure;

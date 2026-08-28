import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { exposureChartConfig } from "@/lib/chart";

const chartData = [
  { state: "human_led", value: 1 },
  { state: "ai_assisted", value: 1 },
  { state: "partly_automated", value: 1 },
  { state: "reshaped", value: 0 },
];

const ExposureChart = () => {
  return (
    <ChartContainer config={exposureChartConfig} className="h-[260px] w-full">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="state"
          tickFormatter={(value) => exposureChartConfig[value as keyof typeof exposureChartConfig]?.label ?? value}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-ai_assisted)" radius={8} />
      </BarChart>
    </ChartContainer>
  );
};

export default ExposureChart;

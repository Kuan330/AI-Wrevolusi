import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { exposureChartConfig } from "@/lib/chart";

interface ExposureChartItem {
  state: keyof typeof exposureChartConfig;
  value: number;
}

interface ExposureChartProps {
  data: ExposureChartItem[];
}

const colorMap: Record<keyof typeof exposureChartConfig, string> = {
  human_led: "hsl(var(--chart-2))",
  ai_assisted: "hsl(var(--chart-1))",
  partly_automated: "hsl(var(--chart-4))",
  reshaped: "hsl(var(--chart-5))",
};

const ExposureChart = ({ data }: ExposureChartProps) => {
  return (
    <ChartContainer config={exposureChartConfig} className="h-[260px] w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="state"
          tickFormatter={(value) =>
            exposureChartConfig[value as keyof typeof exposureChartConfig]?.label ?? value
          }
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" radius={8}>
          {data.map((item) => (
            <Cell key={item.state} fill={colorMap[item.state]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
};

export default ExposureChart;

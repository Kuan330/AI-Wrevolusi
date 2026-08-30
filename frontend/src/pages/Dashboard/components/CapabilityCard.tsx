import { occupationBandFromPotential } from "@/pages/Dashboard/lib/occupationBands";
import DashboardCard from "@/pages/Dashboard/components/DashboardCard";
import { GradientBar } from "@/components/ui/gradient-bar";

type CapabilityCardProps = {
  title: string;
  path: string[];
  potential25: string | null;
  meanScore2025: number | null;
};

const CapabilityCard = ({ title, path, potential25, meanScore2025 }: CapabilityCardProps) => {
  const band = occupationBandFromPotential(potential25);
  const hasScore = typeof meanScore2025 === "number" && !Number.isNaN(meanScore2025);
  const score = hasScore ? Math.min(1, Math.max(0, meanScore2025)) : null;
  const color = band?.color ?? "#9EC9E4";
  const percent = score == null ? null : Math.round(score * 100);

  return (
    <DashboardCard
      id="occupation"
      className="dashboard-overview__capability"
      eyebrow="Your capability"
      title={title}
      description={path.length > 0 ? path.join(" → ") : undefined}
    >
      <div className="mt-auto space-y-3 pt-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug" style={{ color }}>
              {band?.label ?? "Exposure not scored"}
            </p>
            {potential25 ? (
              <p className="mt-1 text-xs text-[#574a55]">{potential25}</p>
            ) : null}
          </div>
          {score != null ? (
            <p className="shrink-0 text-right">
              <span className="text-2xl font-semibold tabular-nums text-[#2f2430]">{score.toFixed(2)}</span>
              <span className="ml-1 text-xs text-[#7f7280]">/ 1.0</span>
            </p>
          ) : null}
        </div>
        {percent != null ? (
          <>
            <GradientBar value={percent} />
            <p className="text-[11px] text-[#7f7280]">{percent}% of the 0–1 occupation index</p>
          </>
        ) : null}
      </div>
    </DashboardCard>
  );
};

export default CapabilityCard;

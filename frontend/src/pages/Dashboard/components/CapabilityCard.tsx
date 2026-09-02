import { ExternalLink } from "lucide-react";

import { GradientBar } from "@/components/ui/gradient-bar";
import DashboardCard from "@/pages/Dashboard/components/DashboardCard";
import {
  ILO_OCCUPATION_EXPOSURE_OPEN_DATA,
  ILO_OCCUPATION_EXPOSURE_SOURCE,
} from "@/pages/Dashboard/lib/dataSources";
import { occupationBandFromPotential } from "@/pages/Dashboard/lib/occupationBands";

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
  const labelColor = band?.ink ?? "#2F5F80";
  const percent = score == null ? null : Math.round(score * 100);

  return (
    <DashboardCard
      id="occupation"
      className="dashboard-overview__capability"
      eyebrow="Occupational AI exposure"
      title={title}
      description={path.length > 0 ? path.join(" → ") : undefined}
    >
      <div className="space-y-3 pt-1">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug" style={{ color: labelColor }}>
              {band?.label ?? "Exposure not scored"}
            </p>
            {band?.description ? (
              <p className="mt-1 text-xs leading-relaxed text-[#574a55]">{band.description}</p>
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
            <GradientBar
              value={percent}
              aria-label={`Occupational AI exposure ${score?.toFixed(2)} out of 1`}
            />
            <div className="flex items-center justify-between gap-3 text-[11px] text-[#7f7280]">
              <span>Exposure index · higher means more AI impact</span>
              <span className="shrink-0 tabular-nums">Low → High</span>
            </div>
          </>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#7f7280]">
          <span className="shrink-0">Source</span>
          <a
            href={ILO_OCCUPATION_EXPOSURE_SOURCE.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#2f5f80] underline-offset-2 hover:underline"
          >
            {ILO_OCCUPATION_EXPOSURE_SOURCE.label}
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
          <a
            href={ILO_OCCUPATION_EXPOSURE_OPEN_DATA.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#2f5f80] underline-offset-2 hover:underline"
          >
            {ILO_OCCUPATION_EXPOSURE_OPEN_DATA.label}
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
        </p>
      </div>
    </DashboardCard>
  );
};

export default CapabilityCard;

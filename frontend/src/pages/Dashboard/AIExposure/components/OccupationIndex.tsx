import { occupationBandFromPotential } from "@/pages/Dashboard/AIExposure/occupationBands";

type OccupationIndexProps = {
  title: string;
  path: string[];
  potential25: string | null;
  meanScore2025: number | null;
};

const OccupationIndex = ({ title, path, potential25, meanScore2025 }: OccupationIndexProps) => {
  const band = occupationBandFromPotential(potential25);
  const score = typeof meanScore2025 === "number" ? Math.min(1, Math.max(0, meanScore2025)) : 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score);
  const color = band?.color ?? "#9EC9E4";

  return (
    <section id="occupation" className="rounded-2xl border bg-card p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your occupation</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      {path.length > 0 ? <p className="mt-1 text-sm text-muted-foreground">{path.join(" → ")}</p> : null}

      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative h-40 w-40 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-semibold tabular-nums leading-none">{score.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">/ 1.0</p>
          </div>
        </div>
        <div className="text-center sm:text-right">
          <p className="text-lg font-semibold" style={{ color }}>
            {band?.label ?? "Exposure not scored"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{potential25 ?? "No ILO 2025 occupation band"}</p>
          <p className="mt-3 max-w-xs text-xs leading-5 text-muted-foreground">
            Occupation mean from ILO 2025. This is the index for this role, not a job-loss score.
          </p>
        </div>
      </div>
    </section>
  );
};

export default OccupationIndex;

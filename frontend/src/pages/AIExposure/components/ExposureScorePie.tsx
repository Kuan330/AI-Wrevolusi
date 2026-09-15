import { useId } from "react";

import {
  formatScorePercent,
  scoreToPercent,
} from "@/pages/Analysis/lib/scorePercent";
import { cn } from "@/lib/utils";
import "./ExposureScorePie.css";

type ExposureScorePieProps = {
  score: number | null;
  label: string;
  meta: string;
  variant?: "tasks" | "occupation";
  className?: string;
};

const ExposureScorePie = (props: ExposureScorePieProps) => {
  const { score, label, meta, variant = "tasks", className } = props;
  const gradientId = useId().replace(/:/g, "");
  const pct = score == null ? null : scoreToPercent(score);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const filled =
    pct == null ? 0 : (Math.min(100, Math.max(0, pct)) / 100) * circumference;

  return (
    <div className={cn("exposure-score-pie", className)}>
      <p className="exposure-score-pie__label">{label}</p>
      <div className="exposure-score-pie__visual">
        <svg
          className="exposure-score-pie__svg"
          viewBox="0 0 88 88"
          role="img"
          aria-label={
            pct == null
              ? `${label}: not available`
              : `${label}: ${formatScorePercent(score)}`
          }
        >
          {variant === "tasks" ? (
            <defs>
              <linearGradient
                id={gradientId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#e8a0b0" />
                <stop offset="42%" stopColor="#c7a0c8" />
                <stop offset="78%" stopColor="#7eb3d9" />
                <stop offset="100%" stopColor="#4f91ba" />
              </linearGradient>
            </defs>
          ) : null}
          <circle
            className="exposure-score-pie__track"
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            strokeWidth="10"
          />
          {pct != null && pct > 0 ? (
            <circle
              className={cn(
                "exposure-score-pie__fill",
                variant === "occupation" && "is-occupation",
              )}
              cx="44"
              cy="44"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
              strokeDashoffset={circumference * 0.25}
              style={
                variant === "tasks" ? { stroke: `url(#${gradientId})` } : undefined
              }
            />
          ) : null}
          <text
            x="44"
            y="44"
            textAnchor="middle"
            dominantBaseline="central"
            className="exposure-score-pie__percent"
          >
            {formatScorePercent(score)}
          </text>
        </svg>
      </div>
      <p className="exposure-score-pie__meta">{meta}</p>
    </div>
  );
};

export default ExposureScorePie;

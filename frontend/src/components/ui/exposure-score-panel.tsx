import type { ComponentProps } from "react";

import { GradientBar } from "@/components/ui/gradient-bar";
import { formatScorePercent, scoreToPercent } from "@/lib/scorePercent";
import { cn } from "@/lib/utils";

import "./exposure-score-panel.css";

type ExposureScorePanelProps = {
  title?: string;
  score: number | null;
  className?: string;
};

const ExposureScorePanel = (props: ExposureScorePanelProps) => {
  const { title = "Task exposure score", score, className } = props;
  if (score == null || !Number.isFinite(score)) return null;

  const clamped = Math.min(1, Math.max(0, score));
  const percent = scoreToPercent(clamped);

  const gradientBarProps1 = {
    value: percent,
    "aria-label": `${title} ${formatScorePercent(clamped)}`,
  } satisfies Partial<ComponentProps<typeof GradientBar>>;
  return (
    <section className={cn("exposure-score-panel", className)}>
      <div className="exposure-score-panel__heading">
        <h3 className="exposure-score-panel__title">{title}</h3>
        <p className="exposure-score-panel__value">
          <strong className="exposure-score-panel__number">
            {formatScorePercent(clamped)}
          </strong>
        </p>
      </div>
      <GradientBar {...gradientBarProps1} />
    </section>
  );
};

export default ExposureScorePanel;

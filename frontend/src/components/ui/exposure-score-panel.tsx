import type { ComponentProps } from "react";
import "./exposure-score-panel.css";

import { GradientBar } from "@/components/ui/gradient-bar";
import { cn } from "@/lib/utils";

type ExposureScorePanelProps = {
  title?: string;
  score: number | null;
  className?: string;
};

const ExposureScorePanel = (props: ExposureScorePanelProps) => {
  const { title = "Task exposure score", score, className } = props;
  if (score == null || !Number.isFinite(score)) return null;

  const clamped = Math.min(1, Math.max(0, score));

  const gradientBarProps1 = {
    value: clamped * 100,
    "aria-label": `${title} ${clamped.toFixed(2)} out of 1`,
  } satisfies Partial<ComponentProps<typeof GradientBar>>;
  return (
    <section className={cn("exposure-score-panel", className)}>
      <div className="exposure-score-panel__heading">
        <h3 className="exposure-score-panel__title">{title}</h3>
        <p className="exposure-score-panel__value">
          <strong className="exposure-score-panel__number">
            {clamped.toFixed(2)}
          </strong>
          <span className="exposure-score-panel__scale">/ 1.0</span>
        </p>
      </div>
      <GradientBar {...gradientBarProps1} />
    </section>
  );
};

export default ExposureScorePanel;

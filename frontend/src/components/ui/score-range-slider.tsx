import type { ComponentProps } from "react";
import "./score-range-slider.css";
import { RotateCcw } from "lucide-react";
import { useId } from "react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { EXPOSURE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

type ScoreRangeSliderProps = {
  value: readonly [number, number];
  onValueChange: (value: [number, number]) => void;
  onReset?: () => void;
  className?: string;
};

/** Shared score range control for task-level GenAI exposure scores. */
const ScoreRangeSlider = (props: ScoreRangeSliderProps) => {
  const { value, onValueChange, onReset, className } = props;
  const labelId = useId();
  const [minimum, maximum] = value;
  const canReset = Boolean(onReset) && (minimum > 0 || maximum < 1);

  const sliderProps1 = {
    rangeStyle: { background: EXPOSURE_GRADIENT_CSS },
    value: [minimum, maximum],
    min: 0,
    max: 1,
    step: 0.01,
    minStepsBetweenThumbs: 1,
    "aria-labelledby": labelId,
    "aria-label": "Filter tasks by score range",
    onValueChange: (nextValue) => {
      const next = nextValue as [number, number];
      onValueChange(next[0] <= next[1] ? next : [next[1], next[0]]);
    },
    className: "score-range__control",
  } satisfies Partial<ComponentProps<typeof Slider>>;
  return (
    <div className={cn("score-range__panel", className)}>
      <div className="score-range__header">
        <div>
          <p id={labelId} className="score-range__label">
            Filter by task score
          </p>
          <p className="score-range__description">
            Show scores from {minimum.toFixed(2)} to {maximum.toFixed(2)}
          </p>
        </div>
        <div className="score-range__value-row">
          {onReset ? (
            <button
              type="button"
              className={cn("score-range__reset", !canReset && "invisible")}
              disabled={!canReset}
              aria-hidden={!canReset}
              aria-label="Reset"
              title="Reset"
              onClick={onReset}
            >
              <RotateCcw
                {...({
                  className: "score-range__reset-icon",
                  "aria-hidden": "true",
                } satisfies Partial<ComponentProps<typeof RotateCcw>>)}
              />
              <span className="score-range__reset-tooltip">Reset</span>
            </button>
          ) : null}
          <span className="score-range__value">
            {minimum.toFixed(2)}–{maximum.toFixed(2)}
          </span>
        </div>
      </div>
      <Slider {...sliderProps1} />
      <div className="score-range__endpoints">
        <span>
          <strong className="score-range__endpoint-value">0</strong> · No GenAI
          automation potential
        </span>
        <span>
          <strong className="score-range__endpoint-value">1</strong> · Full
          GenAI automation potential
        </span>
      </div>
    </div>
  );
};

export default ScoreRangeSlider;

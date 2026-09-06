import "./score-range-slider.css";
import { useId } from "react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { EXPOSURE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

type ScoreRangeSliderProps = {
  value: readonly [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
};

/** Shared score range control for task-level GenAI exposure scores. */
const ScoreRangeSlider = ({ value, onValueChange, className }: ScoreRangeSliderProps) => {
  const labelId = useId();
  const [minimum, maximum] = value;

  return (
    <div className={cn("score-range__panel", className)}>
      <div className="score-range__header">
        <div>
          <p id={labelId} className="score-range__label">
            Filter by task score
          </p>
          <p className="score-range__description">Show scores from {minimum.toFixed(2)} to {maximum.toFixed(2)}</p>
        </div>
        <span className="score-range__value">
          {minimum.toFixed(2)}–{maximum.toFixed(2)}
        </span>
      </div>
      <Slider
        rangeStyle={{ background: EXPOSURE_GRADIENT_CSS }}
        value={[minimum, maximum]}
        min={0}
        max={1}
        step={0.01}
        minStepsBetweenThumbs={1}
        aria-labelledby={labelId}
        aria-label="Filter tasks by score range"
        onValueChange={(nextValue) => {
          const next = nextValue as [number, number];
          onValueChange(next[0] <= next[1] ? next : [next[1], next[0]]);
        }}
        className="score-range__control"
      />
      <div className="score-range__endpoints">
        <span><strong className="score-range__endpoint-value">0</strong> · task basically cannot be automated by GenAI</span>
        <span><strong className="score-range__endpoint-value">1</strong> · task theoretically can be fully automated by GenAI</span>
      </div>
    </div>
  );
};

export default ScoreRangeSlider;

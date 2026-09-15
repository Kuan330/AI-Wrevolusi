import type { ComponentProps } from "react";
import { ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoPopover } from "@/components/ui/info-popover";
import { EXPOSURE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";
import {
  ILO_OCCUPATION_EXPOSURE_OPEN_DATA,
  ILO_OCCUPATION_EXPOSURE_SOURCE,
} from "@/pages/Analysis/lib/dataSources";
import { occupationBandFromPotential, plainOccupationBandLabel } from "@/pages/Analysis/lib/occupationBands";
import type { ExposureCompareInsight } from "@/pages/AIExposure/lib/exposureCompare";
import ExposureScorePie from "@/pages/AIExposure/components/ExposureScorePie";
import { formatScorePercent, scoreToPercent } from "@/pages/Analysis/lib/scorePercent";
import "./ExposureCompareCard.css";

type ExposureCompareCardProps = {
  occupationTitle: string;
  potential25: string | null;
  insight: ExposureCompareInsight;
  onOpenDetails: () => void;
  onViewTasks: () => void;
};

const markerLeft = (score: number | null) =>
  score == null ? null : `${Math.min(100, Math.max(0, score * 100))}%`;

const ExposureCompareCard = (props: ExposureCompareCardProps) => {
  const {
    occupationTitle,
    potential25,
    insight,
    onOpenDetails,
    onViewTasks,
  } = props;
  const band = occupationBandFromPotential(potential25);
  const occupationPlainLabel =
    plainOccupationBandLabel(potential25) ??
    (band ? band.label : "Typical GenAI exposure for this job");
  const occupationLeft = markerLeft(insight.occupationScore);
  const taskLeft = markerLeft(insight.taskMean);

  const infoProps = {
    className: "exposure-compare__info-icon",
    "aria-hidden": "true",
  } satisfies Partial<ComponentProps<typeof Info>>;
  const externalLinkProps = {
    className: "exposure-compare__source-icon",
    "aria-hidden": "true",
  } satisfies Partial<ComponentProps<typeof ExternalLink>>;
  const ctaProps = {
    type: "button",
    variant: "ghost",
    className: "exposure-compare__cta",
    style: { background: EXPOSURE_GRADIENT_CSS },
    onClick: onViewTasks,
  } satisfies Partial<ComponentProps<typeof Button>>;

  const renderMarkerDot = (
    kind: "tasks" | "occupation",
    left: string | null,
  ) => {
    if (left == null) return null;
    return (
      <span
        className={`exposure-compare__marker is-${kind}`}
        style={{ left }}
        aria-hidden
      >
        <span
          className="exposure-compare__marker-dot"
          style={
            kind === "tasks"
              ? { background: EXPOSURE_GRADIENT_CSS }
              : undefined
          }
        />
      </span>
    );
  };

  return (
    <section className="exposure-glass-card exposure-compare">
      <div className="exposure-compare__header">
        <div className="min-w-0">
          <p className="exposure-kicker">Compare your exposure</p>
          <h2 className="exposure-compare__title">
            See how your confirmed tasks compare with the occupation reference.
          </h2>
          <p className="exposure-compare__subtitle">
            <strong>{occupationTitle}</strong>
            <InfoPopover label="Occupation category and source">
              <div className="exposure-compare__category">
                <p className="exposure-compare__category-kicker">
                  ILO occupation category
                </p>
                {band ? (
                  <>
                    <p
                      className="exposure-compare__category-label"
                      style={{ color: band.ink }}
                    >
                      {band.label}
                    </p>
                    <p className="exposure-compare__category-copy">
                      {band.description}
                    </p>
                  </>
                ) : (
                  <p className="exposure-compare__category-copy">
                    An ILO category is not available for this occupation.
                  </p>
                )}
                <p className="exposure-compare__category-sources">
                  <span>Source</span>
                  <a
                    href={ILO_OCCUPATION_EXPOSURE_SOURCE.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {ILO_OCCUPATION_EXPOSURE_SOURCE.label}
                    <ExternalLink {...externalLinkProps} />
                  </a>
                  <a
                    href={ILO_OCCUPATION_EXPOSURE_OPEN_DATA.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {ILO_OCCUPATION_EXPOSURE_OPEN_DATA.label}
                    <ExternalLink {...externalLinkProps} />
                  </a>
                </p>
              </div>
            </InfoPopover>
          </p>
        </div>
        <button
          type="button"
          aria-label="More information about exposure scores"
          className="exposure-compare__info-button"
          onClick={onOpenDetails}
        >
          <Info {...infoProps} />
        </button>
      </div>

      <div className="exposure-compare__scores" aria-label="Score comparison">
        <ExposureScorePie
          score={insight.taskMean}
          label="Your confirmed tasks"
          variant="tasks"
          meta={
            insight.scoredCount === 0
              ? "Add scored tasks to see your average"
              : `Average from ${insight.scoredCount} of your tasks`
          }
        />
        <ExposureScorePie
          score={insight.occupationScore}
          label="Occupation reference"
          variant="occupation"
          meta={occupationPlainLabel}
        />
      </div>

      {insight.delta != null && (
        <p className="exposure-compare__delta-line" aria-live="polite">
          Your tasks are{" "}
          <strong>
            {scoreToPercent(Math.abs(insight.delta))}%{" "}
            {insight.kind === "above"
              ? "above"
              : insight.kind === "below"
                ? "below"
                : "from"}
          </strong>{" "}
          the occupation reference
        </p>
      )}

      <div
        className="exposure-compare__axis"
        role="img"
        aria-label={
          insight.occupationScore != null && insight.taskMean != null
            ? `Your tasks ${formatScorePercent(insight.taskMean)}, occupation reference ${formatScorePercent(insight.occupationScore)}`
            : "Exposure comparison axis"
        }
      >
        <div className="exposure-compare__axis-ends" aria-hidden>
          <span>Lower exposure</span>
          <span>Higher exposure</span>
        </div>
        <div className="exposure-compare__track-wrap">
          <div
            className="exposure-compare__track"
            style={{ background: EXPOSURE_GRADIENT_CSS }}
          />
          {renderMarkerDot("tasks", taskLeft)}
          {renderMarkerDot("occupation", occupationLeft)}
        </div>
        <div className="exposure-compare__axis-legend" aria-hidden>
          <span className="exposure-compare__axis-legend-item">
            <span
              className="exposure-compare__axis-legend-dot is-tasks"
              style={{ background: EXPOSURE_GRADIENT_CSS }}
            />
            Your tasks
            {insight.taskMean != null ? (
              <strong>{formatScorePercent(insight.taskMean)}</strong>
            ) : null}
          </span>
          <span className="exposure-compare__axis-legend-item">
            <span className="exposure-compare__axis-legend-dot is-occupation" />
            Occupation
            {insight.occupationScore != null ? (
              <strong>{formatScorePercent(insight.occupationScore)}</strong>
            ) : null}
          </span>
        </div>
      </div>

      <div className={`exposure-compare__tip is-${insight.kind}`}>
        <div className="exposure-compare__tip-copy-block">
          <p className="exposure-compare__tip-headline">{insight.summary}</p>
          <p className="exposure-compare__tip-copy">{insight.disclaimer}</p>
          <p className="exposure-compare__tip-copy">{insight.tip}</p>
        </div>
        <Button {...ctaProps}>{insight.ctaLabel}</Button>
      </div>
    </section>
  );
};

export default ExposureCompareCard;

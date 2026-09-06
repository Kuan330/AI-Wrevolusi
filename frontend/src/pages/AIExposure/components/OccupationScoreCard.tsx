import "./OccupationScoreCard.css";
import { ExternalLink, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientBar } from "@/components/ui/gradient-bar";
import { ILO_OCCUPATION_EXPOSURE_OPEN_DATA, ILO_OCCUPATION_EXPOSURE_SOURCE } from "@/pages/Analysis/lib/dataSources";
type OccupationScoreCardProps = {
  score: number | null;
  onOpenDetails: () => void;
};

const OccupationScoreCard = ({ score: rawScore, onOpenDetails }: OccupationScoreCardProps) => {
  const score = typeof rawScore === "number" && Number.isFinite(rawScore)
    ? Math.min(1, Math.max(0, rawScore))
    : null;
  const percent = score == null ? null : Math.round(score * 100);

  return (
    <Card className="analysis-card occupation-score__card">
      <CardHeader className="occupation-score__header">
        <div className="occupation-score__heading">
          <div className="occupation-score__heading-content">
            <p className="occupation-score__eyebrow">
              Occupational AI exposure
            </p>
            <CardTitle className="occupation-score__title">
              What the exposure score means
            </CardTitle>
          </div>
        </div>
        <CardDescription className="occupation-score__description">
          A relative 0–1 index of how much the assessed tasks may be affected by generative AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="occupation-score__body">
          <div className="occupation-score__value-row">
            <p className="occupation-score__value">
              <span className="occupation-score__number">
                {score == null ? "—" : score.toFixed(2)}
              </span>
              <span className="occupation-score__scale">/ 1.0</span>
            </p>
            <button
              type="button"
              aria-label="More information about the exposure score"
              className="occupation-score__info-button"
              onClick={onOpenDetails}
            >
              <Info className="occupation-score__info-icon" aria-hidden="true" />
            </button>
          </div>
        {percent != null ? (
          <>
            <GradientBar
              value={percent}
              aria-label={`Occupational AI exposure ${score?.toFixed(2)} out of 1`}
            />
            <div className="occupation-score__legend">
              <span>Occupation mean score · higher means more AI impact</span>
              <span className="occupation-score__legend-end">Low → High</span>
            </div>
          </>
        ) : (
          <p className="occupation-score__unavailable">An occupational mean score is not available for this analysis.</p>
        )}
        <p className="occupation-score__sources">
          <span className="occupation-score__source-label">Source</span>
          <a
            href={ILO_OCCUPATION_EXPOSURE_SOURCE.href}
            target="_blank"
            rel="noopener noreferrer"
            className="occupation-score__source-link"
          >
            {ILO_OCCUPATION_EXPOSURE_SOURCE.label}
            <ExternalLink className="occupation-score__source-icon" aria-hidden="true" />
          </a>
          <a
            href={ILO_OCCUPATION_EXPOSURE_OPEN_DATA.href}
            target="_blank"
            rel="noopener noreferrer"
            className="occupation-score__source-link"
          >
            {ILO_OCCUPATION_EXPOSURE_OPEN_DATA.label}
            <ExternalLink className="occupation-score__source-icon" aria-hidden="true" />
          </a>
        </p>
      </CardContent>
    </Card>
  );
};


export default OccupationScoreCard;

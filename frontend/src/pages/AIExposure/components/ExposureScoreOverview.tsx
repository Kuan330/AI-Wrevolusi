import { ExternalLink } from "lucide-react";

import ExposureScorePanel from "@/components/ui/exposure-score-panel";
import ExposureScoreExplanation from "@/pages/Analysis/components/ExposureScoreExplanation";
import {
  ILO_OCCUPATION_EXPOSURE_OPEN_DATA,
  ILO_OCCUPATION_EXPOSURE_SOURCE,
} from "@/pages/Analysis/lib/dataSources";
import type { TaskScoreRange } from "@/pages/Analysis/lib/taskScore";
import type { TaskOverview } from "@/pages/AIExposure/lib/taskOverview";

type ExposureScoreOverviewProps = {
  overview: TaskOverview;
  range: TaskScoreRange;
};

const ExposureScoreOverview = ({ overview, range }: ExposureScoreOverviewProps) => {
  return (
    <section className="exposure-glass-card overflow-hidden">
      <div className="exposure-score-overview__grid">
        <div className="exposure-score-overview__copy">
          <p className="exposure-kicker">AI exposure</p>
          <h2 className="exposure-score-overview__heading">
            What the exposure score means
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#574a55]">
            How to read the occupational mean score and its ILO classification limits.
          </p>
          <div className="mt-5">
            <ExposureScoreExplanation />
          </div>
        </div>

        <div className="exposure-score-overview__panel">
          <p className="exposure-kicker">Your confirmed tasks</p>
          <h3 className="mt-1 text-xl font-semibold text-[#2f2430]">
            Your task exposure at a glance
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#7f7280]">
            A relative 0–1 index of how much the assessed tasks may be affected by generative AI.
          </p>

          <dl className="exposure-score-overview__metrics">
            <div>
              <dt>Tasks with scores</dt>
              <dd>{overview.scored.length}</dd>
            </div>
            <div>
              <dt>Your task mean</dt>
              <dd>
                {overview.mean?.toFixed(2) ?? "—"}
                <small> / 1.0</small>
              </dd>
            </div>
            <div>
              <dt>In selected range</dt>
              <dd>{overview.percentage === null ? "—" : `${overview.percentage}%`}</dd>
            </div>
          </dl>

          <ExposureScorePanel
            className="mt-4"
            title="Your task mean score"
            score={overview.mean}
          />

          <p className="mt-4 text-xs leading-5 text-[#7f7280]" aria-live="polite">
            {overview.inRange} of {overview.scored.length} scored tasks fall between{" "}
            {range[0].toFixed(2)} and {range[1].toFixed(2)}.
            {overview.missingCount > 0
              ? ` ${overview.missingCount} tasks have no score and are excluded.`
              : null}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#7f7280]">
            Each scored task counts equally. This is a share of tasks, not working time or the
            probability your job will be replaced.
          </p>

          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#7f7280]">
            <span>Source</span>
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
      </div>
    </section>
  );
};

export default ExposureScoreOverview;

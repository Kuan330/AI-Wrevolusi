import type { ComponentProps } from "react";
import { ArrowDown, ExternalLink } from "lucide-react";
import { GradientBar } from "@/components/ui/gradient-bar";
import ExposureScoreExplanation from "@/pages/Analysis/components/ExposureScoreExplanation";
import {
  ILO_OCCUPATION_EXPOSURE_OPEN_DATA,
  ILO_OCCUPATION_EXPOSURE_SOURCE,
} from "@/pages/Analysis/lib/dataSources";
import type { TaskOverview } from "@/pages/AIExposure/lib/taskOverview";

const ExposureScoreOverview = (props: { overview: TaskOverview }) => {
  const { overview } = props;
  const total = overview.scored.length + overview.missingCount;
  const arrowDownProps1 = {
    className: "size-4",
    "aria-hidden": "true",
  } satisfies Partial<ComponentProps<typeof ArrowDown>>;
  const externalLinkProps2 = {
    className: "size-3 shrink-0",
    "aria-hidden": "true",
  } satisfies Partial<ComponentProps<typeof ExternalLink>>;
  const externalLinkProps3 = {
    className: "size-3 shrink-0",
    "aria-hidden": "true",
  } satisfies Partial<ComponentProps<typeof ExternalLink>>;
  return (
    <section className="exposure-glass-card exposure-score-overview__grid overflow-hidden">
      <div className="exposure-score-overview__copy">
        <p className="exposure-kicker">Understanding AI exposure</p>
        <h2 className="exposure-score-overview__heading">
          How to read your score
        </h2>
        <ExposureScoreExplanation className="mt-4" />
      </div>
      <div className="exposure-score-overview__panel">
        <p className="exposure-kicker">Your confirmed tasks</p>
        <h2 className="exposure-score-overview__heading">
          Your task exposure at a glance
        </h2>
        <div className="exposure-score-overview__result">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#3d5f7a]">
              Your task mean score
            </p>
            <p className="tabular-nums text-[#7f7280]">
              <strong className="text-[30px] font-semibold leading-tight text-[#2f2430]">
                {overview.mean?.toFixed(2) ?? "—"}
              </strong>
              <span className="ml-1 text-sm">/ 1.0</span>
            </p>
          </div>
          {overview.mean !== null && (
            <>
              <GradientBar
                {...({
                  value: overview.mean * 100,
                  "aria-label": "Your task mean score",
                  "aria-valuetext": `${overview.mean.toFixed(2)} out of 1`,
                } satisfies Partial<ComponentProps<typeof GradientBar>>)}
              />
              <div className="mt-2 flex justify-between gap-4 text-xs leading-5 text-[#7f7280]">
                <span className="min-w-0 flex-1">
                  <strong className="text-[#3d5f7a]">0</strong> · No GenAI
                  automation potential
                </span>
                <span className="min-w-0 flex-1 text-right">
                  <strong className="text-[#3d5f7a]">1</strong> · Full GenAI
                  automation potential
                </span>
              </div>
            </>
          )}
          <p
            className="mt-4 text-sm leading-6 text-[#574a55]"
            aria-live="polite"
          >
            {overview.scored.length === 0
              ? "No scored tasks available yet."
              : overview.missingCount > 0
                ? `${overview.scored.length} of ${total} tasks have scores.`
                : `Based on ${overview.scored.length} scored ${overview.scored.length === 1 ? "task" : "tasks"}.`}
            {overview.missingCount > 0 && (
              <span className="block">
                {overview.missingCount}{" "}
                {overview.missingCount === 1
                  ? "task without a score is"
                  : "tasks without scores are"}{" "}
                excluded.
              </span>
            )}
          </p>
        </div>
        <details className="exposure-score-overview__calculation">
          <summary>How is this calculated?</summary>
          <div className="mt-3 text-sm leading-6 text-[#574a55]">
            <p className="font-medium text-[#3d5f7a]">
              Average = sum of task scores ÷ number of scored tasks
            </p>
            <p className="mt-2">
              Each scored task counts equally. Tasks without scores are
              excluded.
            </p>
          </div>
        </details>
        <a
          href="#task-breakdown"
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#bad4e4] bg-white/70 px-4 py-2 text-sm font-medium text-[#2f5f80] hover:bg-[#eaf3fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          View task breakdown <ArrowDown {...arrowDownProps1} />
        </a>
        <p className="mt-6 border-t border-[#e4dce7]/70 pt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#7f7280]">
          <span>Source</span>
          <a
            href={ILO_OCCUPATION_EXPOSURE_SOURCE.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#2f5f80] underline-offset-2 hover:underline"
          >
            {ILO_OCCUPATION_EXPOSURE_SOURCE.label}
            <ExternalLink {...externalLinkProps2} />
          </a>
          <a
            href={ILO_OCCUPATION_EXPOSURE_OPEN_DATA.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#2f5f80] underline-offset-2 hover:underline"
          >
            {ILO_OCCUPATION_EXPOSURE_OPEN_DATA.label}
            <ExternalLink {...externalLinkProps3} />
          </a>
        </p>
      </div>
    </section>
  );
};
export default ExposureScoreOverview;

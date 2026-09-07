import { InfoPopover } from "@/components/ui/info-popover";
import { cn } from "@/lib/utils";
import { ILO_EXPOSURE_METHOD_URL } from "@/pages/Analysis/lib/iloExposure";
import { OCCUPATION_BANDS } from "@/pages/Analysis/lib/occupationBands";

type ExposureScoreExplanationProps = {
  className?: string;
};

/** Shared explanation content used by the page and the score details drawer. */
const ExposureScoreExplanation = ({
  className,
}: ExposureScoreExplanationProps) => (
  <div className={cn("grid gap-3", className)}>
    <div className="rounded-xl bg-[#eaf3fb] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#3d5f7a]">
        Read the number
      </p>
      <p className="mt-1 text-sm leading-6 text-[#574a55]">
        Higher means more potential task change, not a forecast of when a job
        will disappear.
      </p>
    </div>
    <div className="rounded-xl bg-[#f8ecef] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8f4f1f]">
        ILO classification
      </p>
      <p className="mt-1 text-sm leading-6 text-[#574a55]">
        Official occupation categories use both the mean (μ) and standard
        deviation (σ) of task scores. A single task score cannot determine an
        occupation category.
        <InfoPopover label="ILO exposure categories">
          <p className="mb-3 text-xs text-[#7f7280]">
            μ = mean task score · σ = variation between task scores
          </p>
          <ul className="divide-y divide-[#e4dce7]">
            {OCCUPATION_BANDS.map((category) => (
              <li
                key={category.value}
                className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-3 py-2.5"
              >
                <span className="flex items-center gap-2 font-semibold text-[#3d5f7a]">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: category.color }}
                    aria-hidden="true"
                  />
                  {category.label.replace("Exposed: ", "")}
                </span>
                <span>{category.rule}</span>
              </li>
            ))}
          </ul>
          <a
            className="mt-3 block border-t border-[#e4dce7] pt-3 text-[#2f5f80] underline decoration-[#c7a0c8] underline-offset-4"
            href={ILO_EXPOSURE_METHOD_URL}
            target="_blank"
            rel="noreferrer"
          >
            ILO Working Paper 140 · Table 5, p. 38
          </a>
        </InfoPopover>
      </p>
    </div>
    <div className="rounded-xl bg-[#f5f3f8] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#5a3f6c]">
        Know the limits
      </p>
      <p className="mt-1 text-sm leading-6 text-[#574a55]">
        The six categories describe occupations, not individual tasks or the
        probability of job loss. Tasks from one reference occupation can have
        different scores.
      </p>
    </div>
  </div>
);

export default ExposureScoreExplanation;

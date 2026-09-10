import { InfoPopover } from "@/components/ui/info-popover";
import { cn } from "@/lib/utils";
import { ILO_EXPOSURE_METHOD_URL } from "@/pages/Analysis/lib/iloExposure";
import { OCCUPATION_BANDS } from "@/pages/Analysis/lib/occupationBands";

/** Plain-language score guidance; classification details stay in one popover. */
const ExposureScoreExplanation = ({ className }: { className?: string }) => (
  <div className={cn("divide-y divide-[#e4dce7]/70", className)}>
    <div className="py-5">
      <h3 className="text-sm font-semibold text-[#3d5f7a]">Read the number</h3>
      <p className="mt-2 text-sm leading-6 text-[#574a55]">Higher scores indicate greater potential for your tasks to change with generative AI.</p>
    </div>
    <div className="py-5">
      <h3 className="text-sm font-semibold text-[#5a3f6c]">Know the limits</h3>
      <p className="mt-2 text-sm leading-6 text-[#574a55]">The score does not predict whether or when you will lose your job.</p>
    </div>
    <div className="py-5">
      <div className="flex items-center">
        <h3 className="text-sm font-semibold text-[#3d5f7a]">ILO classification</h3>
        <InfoPopover label="ILO exposure categories">
          <p>Official ILO occupation categories use both the mean and the variation of task scores. Your selected-task average does not determine an official occupation category.</p>
          <p className="mt-2">The six categories describe occupations, not individual tasks or the probability of job loss. Tasks within one occupation can have different scores.</p>
          <p className="my-3 text-xs text-[#7f7280]">
            μ = mean task score · σ = standard deviation (variation between task scores)
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
      </div>
      <p className="mt-2 text-sm leading-6 text-[#574a55]">Your selected-task average is not an official ILO occupation category.</p>
    </div>
  </div>
);

export default ExposureScoreExplanation;

import type { ComponentProps } from "react";
import SkillsInfoPopover from "@/pages/Skills/components/SkillsInfoPopover";

const SkillFrameworkInfo = () => {
  const skillsInfoPopoverProps1 = {
    ariaLabel: "About the 26-skill framework",
    title: "Why these 26 skills?",
  } satisfies Partial<ComponentProps<typeof SkillsInfoPopover>>;
  return (
    <SkillsInfoPopover {...skillsInfoPopoverProps1}>
      <p className="mt-2 text-xs leading-5 text-[#574a55]">
        They come from the World Economic Forum&apos;s Future of Jobs framework
        and provide a shared language for describing the skills people use as
        work changes.
      </p>
      <p className="mt-3 border-t border-[#d6e4f0]/70 pt-3 text-xs leading-5 text-[#7f7280]">
        Highlighted skills have evidence in at least one task you confirmed.
        Other skills remain visible for context and are not a score of what you
        can or cannot do.
      </p>
    </SkillsInfoPopover>
  );
};

export default SkillFrameworkInfo;

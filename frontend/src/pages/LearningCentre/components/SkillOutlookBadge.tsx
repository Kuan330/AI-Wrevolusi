import { useRef, type RefObject } from "react";
import { Popover } from "@base-ui/react/popover";
import type { WefSkill } from "@/types/reference";
import SkillOutlookSummary from "@/pages/Skills/components/SkillOutlookSummary";
import { PAGE_GRADIENT_CSS } from "@/constants/palette";

export type SkillOutlookBadgeProps = {
  skill: WefSkill;
  /**
   * Element the popup is portaled into. Point it at the host sheet so the card
   * stays interactive while a modal sheet is open.
   */
  container?: RefObject<HTMLElement | null>;
  /** Called once a skill is added or removed, so hosts can refresh their lists. */
  onSkillsChanged?: () => void;
};

/** Course skill badge with the same hover outlook card used on AI Impact. */
const SkillOutlookBadge = (props: SkillOutlookBadgeProps) => {
  const { skill, container, onSkillsChanged } = props;
  const actionsRef = useRef<Popover.Root.Actions | null>(null);
  const blockHoverUntilLeave = useRef(false);

  /** Close the card after add or remove, and keep it closed until the pointer leaves. */
  const dismissOutlook = () => {
    blockHoverUntilLeave.current = true;
    actionsRef.current?.close();
    onSkillsChanged?.();
  };

  return (
    <Popover.Root
      actionsRef={actionsRef}
      onOpenChange={(next, details) => {
        if (next && blockHoverUntilLeave.current) {
          details.cancel();
        }
      }}
    >
      <Popover.Trigger
        openOnHover
        delay={160}
        closeDelay={120}
        nativeButton
        type="button"
        className="learning-course-skill-badge"
        onPointerLeave={() => {
          blockHoverUntilLeave.current = false;
        }}
      >
        <span>{skill.core_skill}</span>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          className="z-[80]"
        >
          <Popover.Popup
            initialFocus={false}
            style={{ background: PAGE_GRADIENT_CSS }}
            className="w-[min(42rem,calc(100vw-1.5rem))] max-h-[var(--available-height)] overflow-y-auto rounded-xl border border-[#dfd5e4] p-2.5 pb-2 shadow-xl outline-none"
          >
            <SkillOutlookSummary
              skill={skill}
              compact
              showAddToLearning
              onAddComplete={dismissOutlook}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default SkillOutlookBadge;

import { Checkbox } from "@/components/ui/checkbox";

const items = [
  "I can pause this plan without penalty.",
  "I can resume from the latest confirmed state.",
  "I can lower weekly effort when life capacity changes.",
];

const FlexibilityChecklist = () => {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <label key={item} className="flex items-center gap-2 text-sm">
          <Checkbox />
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
};

export default FlexibilityChecklist;

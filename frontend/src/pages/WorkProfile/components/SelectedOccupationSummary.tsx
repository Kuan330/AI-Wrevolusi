import type { ReferenceOccupation } from "@/types/reference";

type SelectedOccupationSummaryProps = {
  occupation: ReferenceOccupation | null;
};

const SelectedOccupationSummary = (props: SelectedOccupationSummaryProps) => {
  const { occupation } = props;
  const description = occupation?.description?.trim();

  if (!occupation) {
    return (
      <p className="text-sm text-muted-foreground">
        No occupation selected yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Selected: {occupation.title}
      </p>
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
};

export default SelectedOccupationSummary;

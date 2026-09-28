import type { ReferenceOccupation } from "@/types/reference";

type SelectedOccupationSummaryProps = { occupation: ReferenceOccupation | null };

export default function SelectedOccupationSummary({ occupation }: SelectedOccupationSummaryProps) {
  if (!occupation) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Your selected job</p>
      <p className="text-base font-semibold">{occupation.title}</p>
      {occupation.description?.trim() && <details className="text-sm text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-3">What does this job include?</summary>
        <p className="pb-2 leading-relaxed">{occupation.description.trim()}</p>
      </details>}
    </div>
  );
}

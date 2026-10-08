import { Link } from "react-router-dom";
import { CheckCircle2, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { suggestionTarget } from "@/features/resume/interviewSuggestions";
import { reviewState } from "@/features/resume/review";
import type { InterviewSuggestion, ResumeDraft } from "@/features/resume/types";

type Props = { draft: ResumeDraft; locked: boolean; onReview: () => void; onAccept: (suggestion: InterviewSuggestion) => void; onDismiss: (id: string) => void };
const dateText = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
/** Marks the version used by interview practice, and lists points sent back from practice for the user to accept or dismiss. */
export default function ResumeReview({ draft, locked, onReview, onAccept, onDismiss }: Props) {
  const state = reviewState(draft), suggestions = draft.interviewSuggestions ?? [];
  if (state.status === "missing") return null;
  return <div className="rw-review">
    <div className="rw-review-line" role="status">
      {state.status === "reviewed"
        ? <><CheckCircle2 size={15} className="rw-review-ok" /><span>Reviewed on {dateText(state.at!)}. Interview practice uses this version.</span><Link to={ROUTES.interview}>Practise for an interview</Link></>
        : <><span>Interview practice uses the version you review. Check your resume, then confirm.</span><Button size="sm" variant="outline" disabled={locked} onClick={onReview}>I reviewed this resume</Button></>}
    </div>
    {suggestions.map(suggestion => { const target = suggestionTarget(draft.document!, suggestion); return <div key={suggestion.id} className="rw-review-suggestion">
      <MessageSquareQuote size={15} aria-hidden="true" />
      <div><strong>From interview practice, for “{suggestion.entryLabel}”</strong><p>{suggestion.text}</p>
        {!target && <p className="rw-review-warn">This entry has changed since practice. Dismiss this, or add the point by hand.</p>}</div>
      <div className="rw-review-actions">{target && <Button size="sm" disabled={locked} onClick={() => onAccept(suggestion)}>Add to this entry</Button>}<Button size="sm" variant="ghost" onClick={() => onDismiss(suggestion.id)}>Dismiss</Button></div>
    </div>; })}
  </div>;
}

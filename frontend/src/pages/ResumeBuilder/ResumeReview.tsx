import { Link } from "react-router-dom";
import { MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { suggestionTarget } from "@/features/resume/interviewSuggestions";
import type { InterviewSuggestion, ResumeDraft } from "@/features/resume/types";

type Props = { draft: ResumeDraft; locked: boolean; onAccept: (suggestion: InterviewSuggestion) => void; onDismiss: (id: string) => void };
/** Lists points sent back from practice for the user to accept or dismiss. */
export default function ResumeReview({ draft, locked, onAccept, onDismiss }: Props) {
  const suggestions = draft.interviewSuggestions ?? [];
  if (!draft.document) return null;
  return <div className="rw-review">
    <div className="rw-review-line" role="status">
      <span>Interview practice uses your saved resume sections.</span><Link to={ROUTES.interview}>Practise for an interview</Link>
    </div>
    {suggestions.map(suggestion => { const target = suggestionTarget(draft.document!, suggestion); return <div key={suggestion.id} className="rw-review-suggestion">
      <MessageSquareQuote size={15} aria-hidden="true" />
      <div><strong>From interview practice, for “{suggestion.entryLabel}”</strong><p>{suggestion.text}</p>
        {!target && <p className="rw-review-warn">This entry has changed since practice. Dismiss this, or add the point by hand.</p>}</div>
      <div className="rw-review-actions">{target && <Button size="sm" disabled={locked} onClick={() => onAccept(suggestion)}>Add to this entry</Button>}<Button size="sm" variant="ghost" onClick={() => onDismiss(suggestion.id)}>Dismiss</Button></div>
    </div>; })}
  </div>;
}

import { useEffect, useState } from "react";
import { learningNeedsReview, markLearningReviewed } from "@/features/work-profile/reviewState";

export default function LearningReviewNotice() {
  const [needed, setNeeded] = useState(learningNeedsReview);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setNeeded(learningNeedsReview());
    window.addEventListener("workspace-change", refresh);
    return () => window.removeEventListener("workspace-change", refresh);
  }, []);
  if (!needed) return null;
  return (
    <aside className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm" role="status">
      <p>Your work profile changed. Your saved courses, progress and calendar are still here. Review your recommendations and plan to check that they still fit your work.</p>
      <button type="button" className="mt-2 underline underline-offset-4" onClick={() => {
        try {
          markLearningReviewed();
          setNeeded(false);
        } catch {
          setError("Could not save your review. Please try again.");
        }
      }}>Mark reviewed</button>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}

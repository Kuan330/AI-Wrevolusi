import { accountStorage } from "../../services/accountStorage.ts";

const PROFILE_KEY = "aiwrevolusi.userProfile";

export function learningNeedsReview(): boolean {
  try {
    return JSON.parse(accountStorage.getItem(PROFILE_KEY) ?? "null")
      ?.learningReviewNeeded === true;
  } catch {
    return false;
  }
}

export function markLearningReviewed() {
  const profile = JSON.parse(accountStorage.getItem(PROFILE_KEY) ?? "null");
  if (!profile || profile.learningReviewNeeded !== true) return;
  accountStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...profile, learningReviewNeeded: false }),
  );
}

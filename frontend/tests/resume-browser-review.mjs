/** Explicitly review all chapters before first application in offline browser tests. */
export async function applyReviewedResume(page) {
  const review = page.getByRole("dialog", { name: "Review AI suggestions" });
  await review.waitFor();
  for (const row of await review.locator(".rb-proposal").all()) await row.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Apply selected chapters", exact: true }).click();
  await review.waitFor({ state: "hidden" });
}

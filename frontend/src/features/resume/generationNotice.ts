import type { Generation } from "./types.ts";
export function generationNotice(outcome: Generation["outcome"], notices: string[] = [], filterVersion?: Generation["skill_filter_version"]): string {
  const empty = notices.includes("no_related_skills") ? "No role-related skills were identified. The generated version contains reviewed experience and projects but no Skills section." : "";
  if (outcome !== "source_preserved") return empty;
  if (notices.includes("no_polishable_evidence")) return "Your skills and reviewed source are preserved without AI rewriting. This version is not marked as tailored to the new role.";
  const reason = notices.includes("ai_timeout") ? "AI polishing timed out." : notices.includes("ai_unavailable") ? "AI polishing was unavailable." : "AI polishing could not be fully verified.";
  if (filterVersion === "role_relevance_v1" || notices.includes("skill_relevance_incomplete") || empty) {
    const skills = notices.includes("skill_relevance_incomplete") ? "Skill relevance checking was incomplete. Candidates not confirmed as related were excluded from the generated suggestions; retry to assess them." : "Only role-related user skills are included in the generated suggestions.";
    return `${reason} ${skills} ${empty} Unverified text changes were replaced with reviewed original wording. This version is not marked as tailored to the new role.`;
  }
  return `${reason} Skills are complete and unverified changes were replaced with your reviewed original wording. Review the preserved wording. This version is not marked as tailored to the new role.`;
}

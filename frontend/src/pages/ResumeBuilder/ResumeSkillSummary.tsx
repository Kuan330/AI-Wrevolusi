import type { SkillCandidate, SkillSources } from "@/features/resume/types";

export default function ResumeSkillSummary({ skills, sources, courseCount, pending, hasDocument }: { skills: SkillCandidate[]; sources: SkillSources[]; courseCount: number; pending: SkillCandidate[]; hasDocument: boolean }) {
  const count = (kind: string) => sources.filter(source => source.origins.some(origin => origin.kind === kind)).length;
  const missing = new Set(pending.map(skill => skill.id));
  return <section className="rb-skill-summary" aria-label="Combined resume skills">
    <h3>Skills to include · {skills.length}</h3>
    <p>Original resume: {count("reviewed_resume")} · Confirmed skills: {count("platform_confirmed")} · My courses: {count("learning_intention")} skills from {courseCount} saved courses.</p>
    <p>Duplicates are included once. All saved courses count, including courses you have not started or have completed. Skills are not filtered by the target role.</p>
    {hasDocument && <p role="status">{pending.length ? `${pending.length} skills are not yet in your current resume. Generate new suggestions, then select and apply the Skills chapter.` : "All skills from these sources are already in your current resume."}</p>}
    <details><summary>View combined skills</summary><ul>{skills.map(skill => <li key={skill.id}>{skill.name}{hasDocument && missing.has(skill.id) && <strong> · Not yet applied</strong>}</li>)}</ul></details>
  </section>;
}

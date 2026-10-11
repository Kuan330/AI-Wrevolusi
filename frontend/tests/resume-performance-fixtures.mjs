/** Synthetic-only performance fixture. Never shown by the production page. */
export function performanceDocument(skillCount = 250) {
  return { cv: { name: "Performance Sample", email: "synthetic@example.test", sections: {
    Summary: ["Career objective: Management and Organisation Analysts. Reviewed synthetic records and prepared reports."],
    Skills: Array.from({ length: skillCount }, (_, index) => ({ bullet: index === 0 ? "Analytical thinking" : `Synthetic user skill ${String(index).padStart(3, "0")}` })),
    Experience: Array.from({ length: 25 }, (_, index) => ({ company: `Synthetic company ${index + 1}`, position: "Analyst", start_date: "2021-01", end_date: "present", highlights: [`Reviewed ${index + 1} synthetic records and prepared reports.`] })),
    Projects: Array.from({ length: 16 }, (_, index) => ({ name: `Synthetic project ${index + 1}`, date: "Apr 2026", highlights: ["Cleaned 2,400 records.", "Removed 36 duplicates."] })),
  } }, design: { theme: "engineeringresumes" }, settings: { current_date: "2026-10-12" } };
}
export function performanceAlignment(document) {
  return { alignment: { occupation_code: "2421", title: "Management and Organisation Analysts", requirements: [{ skill_id: 1, name: "Analytical thinking" }], links: document.cv.sections.Skills.map((entry, index) => ({ skill_id: `synthetic-${index}`, name: entry.bullet, requirement_skill_id: 1, method: index === 0 ? "standard_mapping" : "ai_semantic", origins: [{ kind: "reviewed_resume", label: "Synthetic reviewed original CV skills", fact_ids: [] }], examples: [], locations: [{ section: "Skills", entry_index: index }] })), summary_fact_ids: [], project_order: [] }, sections: Object.keys(document.cv.sections), contentFingerprint: JSON.stringify(document.cv.sections), needsReview: false };
}

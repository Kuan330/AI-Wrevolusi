import { memo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { AppliedCareerAlignment, ResumeDocument } from "@/features/resume/types";
import { careerAlignmentNeedsReview } from "@/features/resume/careerAlignment";
function CareerAlignment({ value, document }: { value?: AppliedCareerAlignment; document: ResumeDocument | null }) {
  if (!value) return null;
  const { alignment } = value;
  const stale = careerAlignmentNeedsReview(value, document);
  const referenced = new Set(alignment.links.map(link => link.requirement_skill_id));
  return <Accordion type="single" collapsible className="rb-career-alignment"><AccordionItem value="alignment"><AccordionTrigger>Career alignment · {alignment.title}</AccordionTrigger><AccordionContent>
    <p>Based on the platform career reference, rather than a particular employer’s requirements. AI semantic associations are model judgments, not database-confirmed equivalences or assessments of your proficiency.</p>
    {stale ? <p className="rb-warning" role="status">Your resume has changed. Generate and review new suggestions to check its career alignment again.</p> : <>
      <p>{alignment.links.length} user skills linked to {referenced.size} of {alignment.requirements.length} career skill references. Applied chapters: {value.sections.join(", ")}. These counts are not a match score or hiring prediction.</p>
      <p>{alignment.links.filter(link => link.origins.some(origin => origin.kind === "platform_confirmed" || origin.kind === "reviewed_resume")).length} user-confirmed skills · {alignment.links.filter(link => link.examples.length > 0).length} skills with reviewed records · {alignment.links.filter(link => !link.examples.length && !link.origins.some(origin => origin.kind === "platform_confirmed" || origin.kind === "reviewed_resume")).length} learning intentions without reviewed examples. A skill can have multiple sources.</p>
      {alignment.requirements.map(requirement => <div className="rb-alignment-reference" key={requirement.skill_id}><h4>{requirement.name}</h4>{alignment.links.filter(link => link.requirement_skill_id === requirement.skill_id).map(link => <div key={link.skill_id}>
        <strong>{link.name}</strong> <small>{link.method === "standard_mapping" ? "Standard mapping" : "AI semantic judgment"}</small>
        <p>{link.examples.length ? "Supported by reviewed records" : link.origins.some(origin => origin.kind === "platform_confirmed" || origin.kind === "reviewed_resume") ? "User-confirmed skill · no reviewed example linked" : "Learning intention only · no reviewed example linked"}</p>
        <ul>{link.origins.map((origin, index) => <li key={index}>{origin.label} · {origin.kind === "learning_intention" ? "in progress / planned; completion not claimed" : origin.kind === "platform_confirmed" ? "user confirmed" : "reviewed source"}</li>)}</ul>
        {link.examples.map(example => <blockquote key={example.fact_id}><small>{example.kind === "resume" ? "Reviewed CV example · AI association" : "Reviewed self-recorded learning"}</small><p>{example.text}</p></blockquote>)}
        <p>Used in: {link.locations.map(location => `${location.section}, entry ${location.entry_index + 1}`).join("; ")}</p>
      </div>)}{!referenced.has(requirement.skill_id) && <p>Current information does not provide support for an association. This does not establish that you lack this ability.</p>}</div>)}
      {alignment.summary_fact_ids.length > 0 && <p>The career objective summarises {alignment.summary_fact_ids.length} reviewed background records. It does not describe your current job title.</p>}
    </>}
  </AccordionContent></AccordionItem></Accordion>;
}

export default memo(CareerAlignment, (before, after) => before.value === after.value && before.document?.cv.sections === after.document?.cv.sections);

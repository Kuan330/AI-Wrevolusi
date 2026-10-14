"""Assemble career presentation from validated references, never new user facts.

Semantic associations are explicitly model judgments. Exact citations prove the
source exists, not that an external assessor certified the user's competence.
"""
import re
from app.schemas.resume import GeneratedEntry, ResumeSection
from app.schemas.resume_career import VERSION, RoleAlignment, AlignmentLink, AlignmentExample, AlignmentLocation
from app.services.resume_relevance import skill_key
from app.services import resume_generation as reviewed
from app.services.resume_errors import GenerationRejected


def aliases_for(direct, pending):
    return {**{f"d{i+1}": skill for i, skill in enumerate(direct)}, **pending}


def contextual_facts(request):
    allowed = {fid for s in request.source_sections if s.title in {"Experience", "Education", "Summary", "Learning practice", "Professional Development"} for fid in s.fact_ids}
    allowed.update(fid for p in request.source_projects if p.mode == "structured" for fid in p.fact_ids)
    return [f for f in request.evidence if f.id in allowed]


def add_career_presentation(result, request, role, direct, pending, output):
    facts = {f.id: f for f in request.evidence}
    source = {s.skill_id: s.origins for s in request.source_metadata.skill_sources}
    learning = {f.fact_id: f for f in request.source_metadata.learning_facts}
    aliases = aliases_for(direct, pending)
    chosen = {sid for section in result.sections if section.title == "Skills" for entry in section.entries for sid in entry.skill_ids}
    required = {skill_key(s.name): s.skill_id for s in role.skills}
    anchors = {s.id: (required[skill_key(s.name)], "standard_mapping", None) for s in direct if s.id in chosen}
    decisions = {}
    for decision in output.skill_decisions if output else []:
        decisions.setdefault(decision.candidate_id, []).append(decision)
    for alias, candidate in pending.items():
        ds = decisions.get(alias, [])
        if candidate.id in chosen and len(ds) == 1:
            anchors[candidate.id] = (ds[0].requirement_skill_id, "ai_semantic", ds[0].task_id)
    # References/quotes are bounded to real non-Skills content; no inferred prose is saved.
    context = {fid for section in request.source_sections if section.title == "Experience" for fid in section.polishable_fact_ids}
    context.update(fid for p in request.source_projects if p.mode == "structured" for fid in p.highlight_fact_ids)
    context.update(learning)
    examples, seen = {}, set()
    for link in output.evidence_links if output else []:
        candidate = aliases.get(link.candidate_id)
        pair = (link.candidate_id, link.fact_id)
        if not candidate or candidate.id not in anchors or pair in seen or link.fact_id not in context or link.quote not in facts[link.fact_id].text:
            if "alignment_incomplete" not in result.notices: result.notices.append("alignment_incomplete")
            continue
        seen.add(pair)
        origin = learning.get(link.fact_id)
        examples.setdefault(candidate.id, []).append(AlignmentExample(fact_id=link.fact_id, text=facts[link.fact_id].text, kind=origin.kind if origin else "resume"))
    # Reviewed learning explicitly associated with a selected skill is also a real reviewed source.
    for sid in anchors:
        existing = {e.fact_id for e in examples.get(sid, [])}
        for origin in source[sid]:
            if origin.kind == "reviewed_learning":
                for fid in origin.fact_ids:
                    if fid in learning and fid not in existing:
                        row = learning[fid]
                        examples.setdefault(sid, []).append(AlignmentExample(fact_id=fid, text=facts[fid].text, kind=row.kind))
                        existing.add(fid)
    def rank(sid):
        origins = source[sid]
        tier = 0 if examples.get(sid) else 1 if any(o.kind in {"platform_confirmed", "reviewed_resume"} for o in origins) else 2
        return tier, 0 if anchors[sid][1] == "standard_mapping" else 1, skill_key(next(s.name for s in request.skills if s.id == sid))
    skills = next((s for s in result.sections if s.title == "Skills"), None)
    if skills:
        skills.entries.sort(key=lambda entry: rank(entry.skill_ids[0]))
    # Summary is a bounded extractive synthesis: AI selects/rephrases facts, program supplies the objective.
    summary_refs, summary_parts = [], []
    summary_allowed = {fid for section in request.source_sections if section.title in {"Experience", "Education", "Summary"} for fid in section.fact_ids}
    summary_allowed.update(fid for p in request.source_projects if p.mode == "structured" for fid in p.highlight_fact_ids)
    if output:
        for fragment in output.summary:
            try:
                if fragment.fact_id not in summary_allowed or fragment.fact_id in summary_refs or len(fragment.text) > 700:
                    raise GenerationRejected("invalid_reference")
                reviewed.validate_polish(fragment.text, facts[fragment.fact_id], request)
            except GenerationRejected:
                if "career_summary_unavailable" not in result.notices: result.notices.append("career_summary_unavailable")
                continue
            summary_refs.append(fragment.fact_id)
            summary_parts.append(re.sub(r"^[•●▪*\-]\s*", "", fragment.text))
        if summary_parts or not summary_allowed:
            # Put target first; never assert that the user holds that title.
            text = f"Career objective: {role.title}." + (" " + " ".join(summary_parts) if summary_parts else "")
            if len(text) <= 2000:
                result.sections = [s for s in result.sections if s.title != "Summary"]
                result.sections.insert(0, ResumeSection(title="Summary", entries=[GeneratedEntry(text=text, fact_ids=summary_refs, verbatim=True)]))
        elif "career_summary_unavailable" not in result.notices:
            result.notices.append("career_summary_unavailable")
    # A permutation can change presentation, never source ownership. Ambiguity locks order.
    original_order = [p.id for p in request.source_projects]
    order = original_order
    if output and original_order and all(p.mode == "structured" for p in request.source_projects):
        proposed = output.project_order
        if len(proposed) == len(original_order) and set(proposed) == set(original_order):
            order = proposed
            projects = next((s for s in result.sections if s.title == "Projects"), None)
            if projects: projects.entries.sort(key=lambda e: order.index(e.project_id))
        else:
            result.notices.append("project_order_unverified")
    links = []
    for candidate in request.skills:
        if candidate.id not in anchors: continue
        anchor, method, task_id = anchors[candidate.id]
        refs = examples.get(candidate.id, [])
        locations = []
        for section in result.sections:
            for i, entry in enumerate(section.entries):
                if candidate.id in entry.skill_ids or any(e.fact_id in entry.fact_ids for e in refs):
                    locations.append(AlignmentLocation(section=section.title, entry_index=i))
        links.append(AlignmentLink(skill_id=candidate.id, name=candidate.name, requirement_skill_id=anchor, task_id=task_id, method=method, origins=source[candidate.id], examples=refs, locations=locations))
    result.tailoring_version = request.source_metadata.version
    result.role_alignment = RoleAlignment(occupation_code=role.occupation_code, title=role.title,
        requirements=[{"skill_id": s.skill_id, "name": s.name} for s in role.skills], links=links,
        task_references=[t.model_dump() for t in role.task_references] if request.source_metadata.version == VERSION else [],
        summary_fact_ids=summary_refs, project_order=order)
    # Partial validation does not certify a completed tailoring or advance the interview target.
    if any(notice != "no_related_skills" for notice in result.notices):
        result.outcome = "source_preserved"
    return result

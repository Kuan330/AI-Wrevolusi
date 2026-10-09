"""Generation-only assembly. Shared assistant grounding remains partial-entry compatible."""
import re
import unicodedata
from app.schemas.resume import GenerateRequest, GenerateResponse, GeneratedEntry, GeneratedSection, ProjectEntry, SkillsSection
from app.services.resume_errors import GenerationRejected


def assemble_generation(result: GenerateResponse, request: GenerateRequest) -> GenerateResponse:
    from app.services.resume import validate_generation, NUMBERS, ACHIEVEMENT_ACTIONS
    sections = list(result.sections)
    if request.source_projects is not None:
        sources = {p.id: p for p in request.source_projects}
        facts = {f.id: f.text for f in request.evidence}
        project_facts = {fid for p in request.source_projects for fid in p.fact_ids}
        proposed = {}
        for section in sections:
            for entry in section.entries:
                if section.title != "Projects":
                    if entry.project_id or entry.project or project_facts.intersection(entry.fact_ids):
                        raise GenerationRejected("invalid_reference", ["sections", section.title])
                    continue
                original = sources.get(entry.project_id)
                if not original or original.mode != "structured" or entry.project_id in proposed or not entry.project:
                    raise GenerationRejected("invalid_reference", ["sections", "Projects"])
                if entry.skill_ids or not set(entry.fact_ids).issubset(original.fact_ids):
                    raise GenerationRejected("invalid_reference", ["sections", "Projects", "fact_ids"])
                polished = entry.project
                if polished.name != original.name or polished.date != original.date or len(polished.highlights) != len(original.highlight_fact_ids):
                    raise GenerationRejected("unsupported_fact", ["sections", "Projects", "project"])
                for text, fid in zip(polished.highlights, original.highlight_fact_ids):
                    old = facts[fid]
                    # A separate highlight may not borrow achievements or numbers from another.
                    quantity_words = r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million)\b"
                    if NUMBERS.findall(text) != NUMBERS.findall(old) or re.findall(quantity_words, text.lower()) != re.findall(quantity_words, old.lower()):
                        raise GenerationRejected("unsupported_fact", ["sections", "Projects", "highlights"])
                    additional = r"\b(?:boosted|optimised|optimized|increased|reduced|streamlined|executed|oversaw|enhanced|saved|trained|supervised|resolved|launched)\b"
                    actions = {a.lower() for a in [*ACHIEVEMENT_ACTIONS.findall(old), *re.findall(additional, old, re.I)]}
                    aliases = {"developed": "built", "built": "developed", "analysed": "analyzed", "analyzed": "analysed", "summarised": "summarized", "summarized": "summarised", "organised": "organized", "organized": "organised"}
                    if any(a.lower() not in actions and aliases.get(a.lower()) not in actions for a in [*ACHIEVEMENT_ACTIONS.findall(text), *re.findall(additional, text, re.I)]):
                        raise GenerationRejected("unsupported_claim", ["sections", "Projects", "highlights"])
                    # Do not let lowercase novel outcomes evade named-entity/number checks.
                    connectors = set("a an the and or of for to in on at by with from as using that which this these those it its is are was were be been being has have had also then into through".split())
                    equivalents = {"analyzed": "analysed", "summarized": "summarised", "organized": "organised", "developed": "built", "removed": "eliminated"}
                    def vocabulary(value):
                        return {equivalents.get(word, word) for word in re.findall(r"[^\W\d_]+", value.casefold())}
                    if vocabulary(text) - vocabulary(old) - connectors:
                        raise GenerationRejected("unsupported_claim", ["sections", "Projects", "highlights"])
                    validate_generation(GenerateResponse(sections=[GeneratedSection(title="Projects", entries=[GeneratedEntry(text=text, fact_ids=[fid])])]), request)
                # Immutable identity is copied from reviewed input, never from model prose.
                proposed[original.id] = GeneratedEntry(text=original.name, fact_ids=original.fact_ids, project_id=original.id,
                    project=ProjectEntry(name=original.name, date=original.date, highlights=polished.highlights))
        entries = []
        for original in request.source_projects:
            if original.mode == "structured":
                entries.append(proposed.get(original.id) or GeneratedEntry(text=original.name, fact_ids=original.fact_ids, project_id=original.id,
                    project=ProjectEntry(name=original.name, date=original.date, highlights=[re.sub(r"^[•●▪*\-]\s*", "", facts[fid]) for fid in original.highlight_fact_ids])))
            else:
                # Separate raw paragraphs keep extraction boundaries without guessed metadata.
                entries.extend(GeneratedEntry(text=facts[fid], fact_ids=[fid], project_id=original.id) for fid in original.fact_ids)
        if len(entries) > 80:
            raise GenerationRejected("output_limit", ["sections", "Projects"])
        for entry in entries:
            fragments = [entry.text] if not entry.project else [entry.project.name, entry.project.date or "", *entry.project.highlights]
            for text in filter(None, fragments):
                validate_generation(GenerateResponse(sections=[GeneratedSection(title="Projects", entries=[GeneratedEntry(text=text, fact_ids=entry.fact_ids)])]), request)
        sections = [s for s in sections if s.title != "Projects"]
        if entries:
            sections.append(GeneratedSection(title="Projects", entries=entries))
    if not request.skills and request.source_projects is None:
        return GenerateResponse(sections=sections, gaps=result.gaps)
    # Stable, complete, plain labels. Learning selections imply no expertise.
    names = {}
    for skill in request.skills:
        key = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", skill.name).strip()).casefold()
        if key not in names:
            names[key] = skill
    # A complete label is one bullet, even when its name contains commas.
    entries = [GeneratedEntry(text=names[key].name, skill_ids=[names[key].id])
               for key in sorted(names)]
    sections = [s for s in sections if s.title != "Skills"]
    if entries:
        # Check resource injection, but never treat a literal skill label as an achievement.
        for entry in entries:
            if re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|#[A-Za-z_]|\$\$|<[^>]+>|!\[|\]\(\s*(?!https?://|mailto:|tel:)[^\s)]", entry.text, re.I):
                raise GenerationRejected("unsafe_content", ["skills"])
        sections.insert(0, SkillsSection(title="Skills", entries=entries))
    return GenerateResponse(sections=sections, gaps=result.gaps)

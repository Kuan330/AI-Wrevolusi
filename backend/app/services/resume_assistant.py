"""Stateless edits grounded in reviewed current content, never chat as evidence."""
from copy import deepcopy
import logging
import re
import time
from pydantic import ValidationError
from app.schemas.resume import AssistRequest, AssistResponse, GenerateRequest, GenerateResponse, GeneratedSection, GeneratedEntry, Evidence, SkillCandidate
from app.services.resume import validate_generation, ACHIEVEMENT_ACTIONS
from app.services.resume_errors import GenerationRejected, GenerationFailure
from app.services.resume_render import validate_render_document, InvalidResume
from app.services.ai_gateway import AIProviderError
from app.services.model_overrides import ModelOverrideError

logger = logging.getLogger(__name__)
FACT_FIELDS = frozenset("company position institution area degree date start_date end_date location authors doi url name".split())
ADDITIONAL_ACHIEVEMENTS = re.compile(r"\b(boosted|optimised|optimized|increased|reduced|streamlined|executed|oversaw|enhanced|saved|trained|supervised|resolved|launched)\b", re.I)
ENTRY_FIELDS = frozenset("bullet text label details company position institution area degree date start_date end_date location summary highlights name title authors journal doi url number reversed_number".split())
PROMPT = """You are a resume editing assistant. Follow the requested editing instruction but NEVER treat instructions, conversation history or job requirements as factual evidence. Return ONLY JSON conforming to the response schema.
Use only reviewed current entries and existing skills as evidence. Preserve all names, employers, positions, institutions, qualifications, dates and numerical facts exactly. Never infer a skill from a target job. Do not invent achievements, proficiency, certificates or missing experiences. Personal details are omitted or represented by [PRIVATE_N] tokens: retain every such token exactly, never expand or guess it.
The document's sections appear in insertion order. Propose only changed existing sections, using their numeric section_index. Return the complete new list of entries for each changed section, with source_ids for EVERY entry: section-I-entry-J or skill-ID. Keep the current entry types and factual fields, and all unchanged entry values. You may improve summaries/details/highlights, shorten wording and reorder entries within the same section. Skills based only on a skill name must remain ability phrases, not past achievements. Do not convert a Skills section into work experience. With no sources, propose no content.
Design edits must be scalar changes at safe paths listed in design_paths; theme must be built-in. Never emit templates, photos, file paths, resources, Python/Typst/HTML code, custom themes or personal/header contact edits. Do not modify locale/settings. Do not promise exact page counts. message is a brief English explanation of the proposed edits, not new biographical claims. Unchanged sections/design are omitted. Conversation history is context for instructions only; unapproved suggestions are not facts."""

def entry_text(entry):
    if isinstance(entry, str): return entry
    if isinstance(entry, dict): return " ".join(entry_text(value) for value in entry.values())
    if isinstance(entry, list): return " ".join(entry_text(value) for value in entry)
    return "" if entry is None else str(entry)

def design_paths(document):
    from rendercv.schema.models.rendercv_model import RenderCVModel
    defaults = RenderCVModel.model_validate({"cv": {"sections": {}}, "design": {"theme": document.get("design", {}).get("theme", "classic")}}).design.model_dump(mode="json")
    paths = []
    def visit(value, path=()):
        for key, item in value.items():
            if key in {"templates", "photo", "phone_number_format"} or "photo" in key: continue
            if isinstance(item, dict): visit(item, (*path, key))
            elif not isinstance(item, list): paths.append([*path, key])
    visit(defaults)
    return paths

def validate_context(request):
    from rendercv.schema.models.rendercv_model import RenderCVModel
    validate_render_document(request.document)
    try: RenderCVModel.model_validate(request.document)
    except ValidationError: raise InvalidResume("Correct the resume structure before using the assistant.") from None
    sections = request.document["cv"].get("sections") or {}
    if len(sections) > 50: raise InvalidResume("The assistant supports at most 50 sections.")
    if sum(len(entry_text(entry)) for entries in sections.values() for entry in entries) > 60000:
        raise InvalidResume("Assistant section text exceeds the 60,000-character limit.")
    for entries in sections.values():
        if len(entries) > 80 or any(isinstance(e, dict) and set(e) - ENTRY_FIELDS for e in entries):
            raise InvalidResume("Unsupported assistant entry structure.")

def validate_assistance(result, request):
    from rendercv.schema.models.rendercv_model import RenderCVModel
    sections = list((request.document["cv"].get("sections") or {}).items())
    skills = {"skill-" + s.id: s.name for s in request.skills}
    proposed = deepcopy(request.document)
    # Bound untrusted proposed trees before recursively flattening their text.
    bounded = deepcopy(request.document)
    for change in result.sections:
        if change.section_index >= len(sections): raise GenerationRejected("invalid_reference", ["sections", change.section_index])
        bounded["cv"]["sections"][sections[change.section_index][0]] = [entry.entry for entry in change.entries]
    try: validate_render_document(bounded)
    except InvalidResume: raise GenerationRejected("unsafe_content", ["document"]) from None
    seen = set()
    for change in result.sections:
        si = change.section_index
        path = ["sections", si]
        if si >= len(sections) or si in seen: raise GenerationRejected("invalid_reference", path)
        seen.add(si)
        title, originals = sections[si]
        original_sources = {f"section-{si}-entry-{ei}": entry for ei, entry in enumerate(originals)}
        is_skills = bool(re.search(r"skill|competenc|abilit", title, re.I))
        entries = []
        for ei, candidate in enumerate(change.entries):
            refs = candidate.source_ids
            if len(set(refs)) != len(refs) or any(ref not in original_sources and ref not in skills for ref in refs):
                raise GenerationRejected("invalid_reference", [*path, "entries", ei])
            original_refs = [original_sources[r] for r in refs if r in original_sources]
            entry = candidate.entry
            if original_refs and isinstance(original_refs[0], dict):
                old = original_refs[0]
                if not isinstance(entry, dict) or any(entry.get(field) != old[field] for field in FACT_FIELDS & set(old) if old[field] not in (None, "", [])):
                    raise GenerationRejected("unsupported_fact", [*path, "entries", ei])
            if isinstance(entry, dict):
                if set(entry) - ENTRY_FIELDS: raise GenerationRejected("unsafe_content", [*path, "entries", ei])
                for field in FACT_FIELDS & set(entry):
                    if entry[field] not in (None, "", []) and not any(isinstance(old, dict) and old.get(field) == entry[field] for old in original_refs):
                        raise GenerationRejected("unsupported_fact", [*path, "entries", ei, field])
            text = entry_text(entry)
            if not text.strip(): raise GenerationRejected("missing_evidence", [*path, "entries", ei])
            # Section titles are not evidence; cite only that section's actual entries.
            history_sources = " ".join(entry_text(old) for old in original_refs)
            ability_only = is_skills or not (ACHIEVEMENT_ACTIONS.search(history_sources) or ADDITIONAL_ACHIEVEMENTS.search(history_sources))
            if ability_only:
                sources = " ".join([entry_text(old) for old in original_refs] + [skills[r] for r in refs if r in skills])
                if any(not re.search(rf"(?<!\w){re.escape(action)}(?!\w)", sources, re.I) for action in [*ACHIEVEMENT_ACTIONS.findall(text), *ADDITIONAL_ACHIEVEMENTS.findall(text)]):
                    raise GenerationRejected("unsupported_claim", [*path, "entries", ei])
            fact_texts = [entry_text(old) for old in original_refs]
            skill_texts = [skills[r] for r in refs if r in skills] + ([entry_text(old) for old in original_refs] if is_skills else [])
            facts = [Evidence(id=f"fact-{j}", text=chunk) for j, chunk in enumerate(chunk for value in fact_texts for chunk in (value[i:i+1800] for i in range(0, len(value), 1800)) if chunk.strip())]
            grounded_skills = [SkillCandidate(id=f"skill-{j}", name=value[:160]) for j, value in enumerate(skill_texts) if value.strip()]
            if not facts and not grounded_skills: raise GenerationRejected("missing_evidence", [*path, "entries", ei])
            source_request = GenerateRequest(job_requirements="Resume editing", skills=grounded_skills, evidence=facts, evidence_reviewed=True)
            # Assistant entry lists have RenderCV bounds, not the narrower
            # generation bullet contract. These are internal grounding probes;
            # the actual untrusted proposal was bounded above and remains typed.
            generated = GenerateResponse(sections=[GeneratedSection(title="Skills" if is_skills or not facts else "Experience", entries=[GeneratedEntry.model_construct(text=text, skill_ids=[s.id for s in grounded_skills], fact_ids=[f.id for f in facts])])])
            try: validate_generation(generated, source_request)
            except GenerationRejected as error: raise GenerationRejected(error.code, [*path, "entries", ei]) from None
            # Private placeholders are immutable, including when embedded in text.
            source_tokens = re.findall(r"\[PRIVATE_\d+\]", " ".join(entry_text(old) for old in original_refs))
            if sorted(re.findall(r"\[PRIVATE_\d+\]", text)) != sorted(source_tokens):
                raise GenerationRejected("unsupported_fact", [*path, "entries", ei])
            entries.append(entry)
        proposed["cv"]["sections"][title] = entries
    paths = {tuple(path) for path in design_paths(proposed)}
    design_seen = set()
    for index, change in enumerate(result.design):
        path = tuple(change.path)
        if path not in paths or path in design_seen: raise GenerationRejected("unsafe_content", ["design", index])
        design_seen.add(path)
        target = proposed.setdefault("design", {})
        for key in path[:-1]:
            if key not in target: target[key] = {}
            if not isinstance(target[key], dict): raise GenerationRejected("unsafe_content", ["design", index])
            target = target[key]
        target[path[-1]] = change.value
    try:
        validate_render_document(proposed)
        RenderCVModel.model_validate(proposed)
    except (ValidationError, InvalidResume): raise GenerationRejected("unsafe_content", ["document"]) from None
    return result

def assist_resume(request, provider):
    validate_context(request)
    started = time.monotonic()
    deadline = started + 45
    rejected = None
    for attempt in (1, 2):
        remaining = deadline - time.monotonic()
        if attempt == 2 and remaining < 5: raise rejected
        payload = request.model_dump()
        payload["design_paths"] = design_paths(request.document)
        if rejected: payload["repair_feedback"] = {"code": rejected.code, "fields": rejected.fields}
        try:
            raw = provider.complete_json(operation="resume.assist.v1", payload=payload, response_model=AssistResponse,
                system_prompt=PROMPT + (" This is the single correction: regenerate from original sources and fixed feedback only." if rejected else ""),
                request_timeout_s=max(.001, remaining), request_max_retries=0, request_cache_enabled=False)
            if time.monotonic() >= deadline: raise GenerationFailure("The assistant exceeded its time budget. Your draft is unchanged.", code="ai_budget_exhausted", attempts=attempt)
            return validate_assistance(AssistResponse.model_validate(raw), request)
        except GenerationRejected as error:
            error.attempts = attempt
            lock = getattr(provider, "lock_model", None)
            if callable(lock): lock()
            logger.warning("resume_assist_rejected code=%s attempts=%s status=rejected duration_ms=%.1f", error.code, attempt, (time.monotonic() - started) * 1000)
            if attempt == 2: raise
            rejected = error
        except (ModelOverrideError, GenerationFailure): raise
        except Exception as error:
            code = "ai_schema_invalid" if isinstance(error, ValidationError) else "ai_provider_error" if isinstance(error, AIProviderError) else "internal_error"
            raise GenerationFailure("The assistant could not prepare supported changes. Your draft is unchanged.", code=code, attempts=attempt) from None

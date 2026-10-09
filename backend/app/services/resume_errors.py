"""Safe resume diagnostics: fixed codes and schema keys, never input values."""
from functools import lru_cache

GENERATION_MESSAGES = {
    "duplicate_sections": "AI returned duplicate sections.",
    "duplicate_gaps": "AI returned duplicate skill-gap references.",
    "missing_evidence": "AI returned content without the required source evidence.",
    "invalid_reference": "AI returned an unrecognised source reference.",
    "unsupported_fact": "AI returned a fact or number that could not be verified.",
    "unsupported_claim": "AI returned a proficiency, credential or achievement claim without evidence.",
    "unverified_name": "AI returned a name or term that could not be verified.",
    "output_limit": "The generated section exceeds the supported size. Shorten the reviewed source before retrying.",
    "unsafe_content": "AI returned unsupported contact, code or resource content.",
}
REQUEST_KEYS = frozenset("body occupation_code skill_filter_version candidate_id requirement_skill_id skill_decisions document job_requirements skills evidence evidence_reviewed id name text sections entries gaps title skill_ids fact_ids keywords skill_slugs label course_id gap_ids reason courses repair_feedback code fields field instruction context_reviewed history content role section_index source_ids path value design cv source_projects source_sections heading_fact_id polishable_fact_ids project_id project mode date highlights highlight_fact_ids outcome notices verbatim patches fact_id".split())

@lru_cache(maxsize=1)
def render_keys():
    from rendercv.schema.models.rendercv_model import RenderCVModel
    keys = set(REQUEST_KEYS)
    def visit(node):
        if isinstance(node, dict):
            keys.update(node.get("properties", {}))
            for item in node.values(): visit(item)
        elif isinstance(node, list):
            for item in node: visit(item)
    visit(RenderCVModel.model_json_schema())
    return frozenset(keys)

def safe_fields(locations, *, allowed=REQUEST_KEYS):
    if not isinstance(locations, (list, tuple)): return []
    result = []
    for location in locations[:20]:
        if not isinstance(location, (list, tuple)): continue
        path = []
        for part in location[:18]:
            if type(part) is int and 0 <= part <= 10000: path.append(part)
            elif isinstance(part, str) and part in allowed: path.append(part)
            elif isinstance(part, str) and part.isascii() and part.isdecimal() and len(part) <= 5 and int(part) <= 10000: path.append(int(part))
            else: path.append("field")
        if path and path[0] == "body": path = path[1:]
        if path not in result: result.append(path)
        if len(result) == 5: break
    return result

def render_fields(locations, document):
    cv = document.get("cv", {}) if isinstance(document, dict) else {}
    chapters = cv.get("sections", {}) if isinstance(cv, dict) else {}
    titles = list(chapters) if isinstance(chapters, dict) else []
    paths = []
    for location in locations[:20]:
        path = list(location)
        if len(path) > 2 and path[:2] == ["cv", "sections"]:
            # Even a chapter named like a schema property is user data.
            path[2] = titles.index(path[2]) if path[2] in titles else "field"
        paths.append(path)
    return safe_fields(paths, allowed=render_keys())

class ResumeProblem(ValueError):
    def __init__(self, detail, *, code, fields=(), attempts=0):
        super().__init__(detail)
        self.detail, self.code, self.fields, self.attempts = detail, code, list(fields), attempts

class GenerationRejected(ResumeProblem):
    def __init__(self, code, path=()):
        super().__init__(GENERATION_MESSAGES[code], code=code, fields=safe_fields([path]) if path else [])

class GenerationFailure(ResumeProblem):
    pass

def error_body(error):
    return {"detail": error.detail, "code": error.code, "fields": error.fields}

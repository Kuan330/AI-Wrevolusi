"""Validate reviewed section ownership independently of AI output."""
import re


def section_heading(value):
    value = re.sub(r"\s+", " ", re.sub(r"[:：]\s*$", "", value.strip()))
    for pattern, title in [
        (r"(?:(?:technical|professional|core|key|soft|personal|specialist)\s+)?skills?", "Skills"),
        (r"(?:(?:professional|work|employment|relevant|career)\s+)?experience|employment|work history|employment history", "Experience"),
        (r"(?:(?:academic|personal|selected|professional)\s+)?projects?", "Projects"),
        (r"education(?:\s+(?:and|&)\s+qualifications)?|academic background", "Education"),
        (r"(?:(?:professional|career|personal)\s+)?summary|profile|objective|about me", "Summary"),
    ]:
        if re.fullmatch(pattern, value, re.I): return title
    pattern = r"(?:(?:licenses?|licences?)\s*(?:&|and)\s*)?certifications?|certificates?|licenses?|licences?|awards?|achievements?|references?|interests?|languages?|volunteering|additional information|disclaimer|publications?|professional affiliations|volunteer experience|activities|hobbies"
    if re.fullmatch(pattern, value, re.I):
        return value
    return None


def validate_source_sections(request):
    expected, active = [], None
    for fact in request.evidence:
        title = section_heading(fact.text)
        if title:
            active = {"title": title, "heading_fact_id": fact.id, "fact_ids": [], "polishable_fact_ids": []}
            expected.append(active)
            continue
        if active is None:
            active = {"title": "Additional information", "heading_fact_id": None, "fact_ids": [], "polishable_fact_ids": []}
            expected.append(active)
        active["fact_ids"].append(fact.id)
        if (active["title"] == "Experience" and re.match(r"^[•●▪*\-]\s*\S", fact.text)) or active["title"] == "Summary":
            active["polishable_fact_ids"].append(fact.id)
    if [s.model_dump() for s in request.source_sections] != expected:
        raise ValueError("Source sections must preserve the exact reviewed headings, order and fact ownership.")
    if request.source_projects is None:
        raise ValueError("The reviewed generation flow requires project source metadata.")
    project_ids = {fid for p in request.source_projects for fid in p.fact_ids}
    section_project_ids = {fid for s in request.source_sections if s.title == "Projects" for fid in s.fact_ids}
    if project_ids != section_project_ids:
        raise ValueError("Projects must preserve all reviewed project paragraphs and only those paragraphs.")
    for section in request.source_sections:
        if section.title.startswith("@") or section.title in {"__proto__", "constructor", "prototype"} or re.search(r"<|>|\$\$|#[A-Za-z_]", section.title):
            raise ValueError("Unsupported source section title.")
        if section.title not in {"Skills", "Projects"} and len(section.fact_ids) > 80:
            raise ValueError("The reviewed section exceeds the output limit.")
    counts = {}
    for section in request.source_sections:
        if section.title not in {"Skills", "Projects"}: counts[section.title] = counts.get(section.title, 0) + len(section.fact_ids)
    if any(count > 80 for count in counts.values()): raise ValueError("The reviewed section exceeds the output limit.")

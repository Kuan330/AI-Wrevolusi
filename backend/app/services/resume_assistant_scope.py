"""Conservative context selection without another model call or changing IDs."""
import re

SKILLS = re.compile(r"skill|competenc|abilit", re.I)
ALIASES = {
    "summary": r"\b(summary|profile|objective)\b|摘要|个人简介|职业目标",
    "experience": r"\b(experience|employment|work history)\b|工作经历|工作经验",
    "education": r"\b(education|academic background)\b|教育经历|教育背景",
    "projects": r"\bprojects?\b|项目经历|项目",
    "skills": r"\b(skills?|competencies|abilities)\b|技能",
}
EDIT = re.compile(r"\b(shorten|refine|improve|rewrite|polish|edit|update|remove|delete|reorder|highlight|add|make|simplify)\b|精简|缩短|优化|改写|润色|修改|删除|排序|突出|添加", re.I)
DESIGN = re.compile(r"\b(theme|font|colou?r|palette|margin|spacing|layout|design|moderncv|classic|engineeringresumes|sb2nov|engineeringclassic)\b|主题|字体|字号|颜色|配色|页边距|行距|版式|排版", re.I)
CONTENT = re.compile(r"\b(wording|descriptions?|content|rewrite|facts?|achievements?|remove|delete|add|shorten)\b|措辞|描述|内容|经历|技能|改写|删除|添加|精简", re.I)
GLOBAL = re.compile(r"\b(entire|whole|everything|all sections|throughout|also|except|based on|using|compare|it|that|again)\b|整份|所有章节|全部|同时|除了|根据|参考|它|刚才|继续", re.I)
# Deliberately narrow: unrecognized or mixed requests retain complete context.
WORDING_ONLY = re.compile(r"(?:improve the wording without adding facts|make the descriptions more concise|polish wording|shorten descriptions|润色措辞|精简描述)[.!。！]?", re.I)


def recent_history(history):
    pairs = []
    for index in range(len(history) - 1):
        if history[index].role == "user" and history[index + 1].role == "assistant":
            pairs.append([history[index].model_dump(), history[index + 1].model_dump()])
    return [message for pair in pairs[-2:] for message in pair]


def scope_context(payload):
    """Filter only the provider payload; the full request stays available to validation."""
    instruction = payload["instruction"]
    sections = payload["sections"]
    selected = []
    for section in sections:
        title = section["title"]
        patterns = [re.escape(title)] if title else []
        for category, aliases in ALIASES.items():
            if re.search(aliases, title, re.I) or category == "skills" and SKILLS.search(title):
                patterns.append(aliases)
        if any(re.search(r"(?<!\w)(?:" + pattern + r")(?!\w)" if pattern == re.escape(title) else pattern, instruction, re.I) for pattern in patterns):
            selected.append(section)
    full = bool(GLOBAL.search(instruction))
    if not full and DESIGN.search(instruction) and not selected and not CONTENT.search(instruction):
        mode = "design"
        payload["sections"], payload["skills"], payload["history"] = [], [], []
        payload.pop("target_context", None)
    elif WORDING_ONLY.fullmatch(instruction.strip()):
        mode = "content"
        payload["skills"] = []
        payload.pop("design", None)
        payload["design_paths"] = []
    elif not full and selected and EDIT.search(instruction) and not DESIGN.search(instruction):
        mode = "sections"
        payload["sections"] = selected
        if not any(SKILLS.search(section["title"]) for section in selected):
            payload["skills"] = []
        payload.pop("design", None)
        payload["design_paths"] = []
    else:
        mode = "full"
    payload["scope"] = mode
    return payload


def validate_scope(result, payload):
    from app.services.resume_errors import GenerationRejected
    allowed_sections = {section["section_index"] for section in payload["sections"]}
    allowed_skills = {skill["id"] for skill in payload["skills"]}
    for patch in result.sections:
        if patch.section_index not in allowed_sections or not set(patch.add_skills) <= allowed_skills:
            raise GenerationRejected("invalid_reference", ["sections"])
        for update in patch.updates:
            if any(ref.startswith("k") and ref not in allowed_skills for ref in update.sources()):
                raise GenerationRejected("invalid_reference", ["source_ids"])
    if result.design and payload["scope"] in {"sections", "content"}:
        raise GenerationRejected("invalid_reference", ["design"])

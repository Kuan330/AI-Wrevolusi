"""Keep existing skill identities when the assistant edits their presentation."""
import re
import unicodedata

from app.services.resume_errors import GenerationRejected


SKILL_SECTION = re.compile(r"skill|competenc|abilit|\btechnical expertise\b|\blanguages?\b|\u6280\u80fd|\u8bed\u8a00", re.I)
WORD = re.compile(r"\.?[^\W_]+(?:[.+#][^\W_]*)*", re.UNICODE)
BOILERPLATE = frozenset("a an the of to in on with for and or using use skill skills".split())
ABILITY_PREFIX = re.compile(r"^(?:(?:knowledge|understanding|familiarity|experience)(?:\s+and\s+(?:knowledge|understanding|familiarity|experience))*\s+(?:of|in|with)|(?:ability|able)\s+to|(?:skilled|familiar)\s+(?:in|with))\s+", re.I)
ACRONYM_SUFFIX = re.compile(r"^([^()]+?)\s+\(([a-z][a-z0-9]{1,9})\)$", re.I)
GROUPS = re.compile(r"[,;|\n]|\s+(?:and|or)\s+|\s*&\s*|\s+/\s+|[\u3001\uff0c\uff1b]", re.I)
REMOVE = re.compile(r"\b(remove|delete|drop|omit|exclude|eliminate)\b|\u5220\u9664|\u79fb\u9664|\u53bb\u6389|\u5220\u6389|\u5220\u53bb", re.I)
NEGATIVE = re.compile(r"\b(no|not|never|avoid|without)\b|\b\w+n['\u2019]t\b|\u4e0d|\u522b|\u907f\u514d|\u7981\u6b62", re.I)
HYPOTHETICAL = re.compile(r"\b(if|whether|what|why|how|explain|describe|example|say|mention|phrase|quote|suppose|imagine)\b|\b(?:should|could|can)\s+i\b|\u5982\u679c|\u5047\u8bbe|\u662f\u5426|\u5982\u4f55|\u4e3a\u4ec0\u4e48|\u89e3\u91ca|\u4e3e\u4f8b", re.I)
CLAUSES = re.compile(r"[;\n\u3002\uff1b]|\b(?:but|however)\b|\u4f46\u662f|\u4f46|(?:,|\band\b)\s*(?=(?:do not|don['\u2019]t|never|keep|retain|preserve|remove|delete|drop|omit|exclude|eliminate)\b)", re.I)
OBJECT_END = re.compile(r"\b(from|for|because|since|to|which|that|in|around|keep|retain|preserve|except|without|not|never|improve|polish|highlight|emphasize|emphasise|prioritize|prioritise|reorder)\b|\u4f46|\u4e0d|\u522b|\u4fdd\u7559|\u4fdd\u6301|\u56e0\u4e3a|\u4ee5\u4fbf|\u6765\u81ea", re.I)
DUPLICATE = re.compile(r"\b(duplicate|duplicates|repeated|redundant|redundancy)\b|\u91cd\u590d|\u53bb\u91cd", re.I)


def terms(value):
    normalized = unicodedata.normalize("NFKC", value).casefold().strip()
    normalized = ABILITY_PREFIX.sub("", normalized)
    normalized = re.sub(r"\bnode(?:\.|\s+)js\b", "node.js", normalized)
    acronym = ACRONYM_SUFFIX.fullmatch(normalized)
    if acronym:
        initials = "".join(word[0] for word in re.findall(r"[a-z0-9]+", acronym[1]) if word not in BOILERPLATE)
        if initials == acronym[2]:
            normalized = acronym[1]
    words = {word.rstrip(".") for word in WORD.findall(normalized)}
    return words - BOILERPLATE


def skill_groups(value):
    if isinstance(value, str):
        value = ABILITY_PREFIX.sub("", value.strip())
        return [group for part in GROUPS.split(value) if (group := terms(part))]
    if isinstance(value, dict):
        return [group for item in value.values() for group in skill_groups(item)]
    if isinstance(value, list):
        return [group for item in value for group in skill_groups(item)]
    return []


def removal_permissions(instruction, title):
    """Only positive named removal commands authorize losing a skill.

    References to relevance, shortening, history and duplicate removal do not.
    A whole-section request must name its object, not mention it in a reason.
    """
    permitted = []
    section_object = re.compile(
        r"^(?:(?:the|my|all|entire|whole|existing|original|current)\s+)*"
        r"(?:" + re.escape(title) + r"|skills?|competencies|abilities)(?:\s+(?:section|list))?"
        r"(?:\s+from\s+(?:the\s+|my\s+)?(?:resume|cv))?(?:\s+please)?$"
        r"|^(?:\u6211\u7684|\u5168\u90e8|\u6240\u6709|\u6574\u4e2a|\u539f\u6709|\u5df2\u6709)*\u6280\u80fd(?:\u7ae0\u8282|\u90e8\u5206|\u5217\u8868)?$",
        re.I,
    )
    # Keep an example marker attached to its removal verb when splitting commands.
    commands = re.sub(r"\b(for\s+example)\s*,", r"\1 ", instruction, flags=re.I)
    for clause in CLAUSES.split(commands):
        for action in REMOVE.finditer(clause):
            prefix = clause[:action.start()]
            if NEGATIVE.search(prefix) or HYPOTHETICAL.search(prefix):
                continue
            target = clause[action.end():].strip(" .,!?:\u3002\uff01\uff1f\uff0c\uff1a")
            if DUPLICATE.search(target):
                continue
            if section_object.fullmatch(target):
                return True, []
            target = OBJECT_END.split(target, maxsplit=1)[0]
            permitted.extend(skill_groups(target))
    return False, permitted


def validate_skill_retention(instruction, title, originals, candidates, section_index, path):
    if not SKILL_SECTION.search(title):
        return
    remove_section, permitted = removal_permissions(instruction, title)
    if remove_section:
        return
    retained = [group for candidate in candidates for group in skill_groups(candidate.entry)]
    for index, original in enumerate(originals):
        source = f"section-{section_index}-entry-{index}"
        own_groups = [group for candidate in candidates
            if [ref for ref in candidate.source_ids if ref.startswith("section-")] == [source]
            for group in skill_groups(candidate.entry)]
        for group in skill_groups(original):
            if group in permitted or group in retained:
                continue
            # Longer names in other rows are not duplicates of a removed skill.
            if not any(group <= current for current in own_groups):
                raise GenerationRejected("unsupported_fact", path)

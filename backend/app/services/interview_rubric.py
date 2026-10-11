"""Epic 9 rubric: the skills an answer can show, what each level means, and which question intent tests which skill.

These describe what an ANSWER showed, never what a person is like. Levels are capped by how much was said
(see `level_cap`), so a short answer can never score as strong.
"""
import re

# id -> (label, what it looks like when it is shown)
COMPETENCIES: dict[str, tuple[str, str]] = {
    "role_knowledge": ("Role know-how", "uses the facts, methods or standards of the work and says why a choice fits"),
    "problem_solving": ("Problem solving", "breaks a problem into steps, weighs options and explains the choice"),
    "communication": ("Clear communication", "explains things to colleagues, customers or managers so they can act on them"),
    "quality_care": ("Quality and care", "checks accuracy, follows procedures and keeps people or data safe"),
    "teamwork": ("Teamwork and leading", "works with others, shares tasks and handles disagreement"),
    "learning": ("Learning and adapting", "learns from mistakes or new tasks and says what changed afterwards"),
    "ownership": ("Ownership", "says what she personally did, not only what the team did"),
    "results": ("Results", "says what changed or improved because of the work, with a fact, number or outcome"),
    "ai_change": ("Working with AI and change", "explains how a task may change with AI and how output would be checked"),
}

LEVELS = {1: "Not shown yet", 2: "Started", 3: "Clear", 4: "Strong"}

# Question-bank intent -> the skill that question mainly tests.
INTENT_TO_COMPETENCY = {
    "problem_solving": "problem_solving", "debugging": "problem_solving", "requirements_clarification": "problem_solving",
    "prioritisation": "problem_solving",
    "technical_judgement": "role_knowledge", "domain_judgement": "role_knowledge", "financial_analysis": "role_knowledge",
    "campaign_judgement": "role_knowledge",
    "stakeholder_communication": "communication", "customer_communication": "communication",
    "administrative_accuracy": "quality_care", "quality_control": "quality_care", "testing_verification": "quality_care",
    "safety_judgement": "quality_care",
    "leadership": "teamwork", "coordination": "teamwork",
    "learning_reflection": "learning", "role_motivation": "learning",
}


def focus_for(kind: str, intent: str | None) -> str | None:
    """The skill a question mainly tests, or None when the AI should pick from the question itself."""
    if kind == "ai_change":
        return "ai_change"
    return INTENT_TO_COMPETENCY.get(intent or "")


def level_cap(word_count: int) -> int:
    """A short answer cannot show strong skill. This is a limit on the answer, not a judgement of the person."""
    return 2 if word_count < 20 else 3 if word_count < 40 else 4


def rubric_prompt() -> str:
    skills = "\n".join(f"- {key}: {label}. Shown when the answer {what}." for key, (label, what) in COMPETENCIES.items())
    return f"""scores: rate what THIS answer showed, for the focus_competency (when given) and at most three other skills the answer clearly touches. Skills:
{skills}
Levels: 1 not shown yet (no relevant point); 2 started (names an idea or action but it is general or unclear); 3 clear (a specific action or reason that fits the question); 4 strong (specific, reasoned, and includes a check, trade-off or result).
For every score give a short exact quote from the answer in quote (required for level 2 or higher), a one-sentence reason, and next_step: one small change she can make to reach the next level.
Leave a skill out when the question cannot show it. A "how would you" question can show ownership or results only if she describes real past work. Score the answer, never the person. Never score ai_change unless the question is about AI.
structure: for questions about past work, say for situation, task, action and result whether the answer has it (yes, partly, no), with a quote when yes. For "how would you" questions use an empty list.
stronger_answer: when the answer has real content, rewrite it in her voice using ONLY facts, numbers and names already in her answer. Put [square brackets] where a missing fact belongs, for example [add what changed]. Never invent a fact. Use null when the answer is too short to rewrite."""


WORD = re.compile(r"[a-z']+|\d+(?:[.,]\d+)?")
# Words that ask about a step but state no fact. Anything else must already be in the answer or the question.
NEUTRAL = frozenset("""about action after again also another approach because before between challenge change changed check checked choice choose chose
could decide decided describe determine did differently difficult does doing during each else ensure example explain find finding first found handle handled
happen happened have helped how improve improved know learn learned like make made measure more most need next other outcome part person reason result results
same should show some specific step steps sure take tell than that their them then there these they thing think this those through time tried using very want
well were what when where which while who why will with without work worked would your you""".split())


def stem(word: str) -> str:
    return word[:5]


def known_words(*texts: str) -> set[str]:
    return {stem(word) for text in texts for word in WORD.findall(text.lower())}


def invented_words(value: str, *context: str) -> list[str]:
    """Words or numbers in `value` that are not in the supplied text and are not neutral question words."""
    known = known_words(*context)
    numbers = {word for text in context for word in WORD.findall(text.lower()) if word[0].isdigit()}
    bad = []
    for word in WORD.findall(value.lower()):
        if word[0].isdigit():
            if word not in numbers:
                bad.append(word)
        elif len(word) > 3 and stem(word) not in known and word not in NEUTRAL:
            bad.append(word)
    return bad

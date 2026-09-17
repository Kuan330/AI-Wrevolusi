"""Validation for the workspace fields consumed by backend features."""

SHORTLIST_KEY = 'aiwrevolusi.possibilities.shortlist'
MAX_SHORTLIST_SKILLS = 60


def validate_workspace_shortlist(value: object) -> list[int]:
    """Validate stored shape without coupling writes to live reference data."""
    if not isinstance(value, list) or any(type(item) is not int or item <= 0 for item in value):
        raise ValueError('Shortlisted skill IDs must be a list of positive integers.')
    unique = list(dict.fromkeys(value))
    if len(unique) > MAX_SHORTLIST_SKILLS:
        raise ValueError('Too many shortlisted skills.')
    return unique


def read_workspace_shortlist(value: object, *, allowed_skill_ids: set[int]) -> list[int]:
    """Tolerate legacy shapes and retired IDs without breaking account reads."""
    if not isinstance(value, list):
        return []
    return list(dict.fromkeys(
        item for item in value if type(item) is int and item in allowed_skill_ids
    ))[:MAX_SHORTLIST_SKILLS]

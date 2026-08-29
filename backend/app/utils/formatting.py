def title_case(value: str) -> str:
    return ' '.join(part.capitalize() for part in value.replace('_', ' ').split())


def compact_code(value: str) -> str:
    return value.strip().upper().replace(' ', '')

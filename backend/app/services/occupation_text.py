"""Shared SQL for occupation text shown to users."""

# An earlier ISCO-08 import filled every description with this stand-in sentence.
# It describes the dataset, not the job, so it must never reach the page.
ILO_PLACEHOLDER_DESCRIPTION = 'Occupational group from the ILO 2025 task dataset (ISCO-08).'


def occupation_description_sql(column: str = 'description') -> str:
    """Select ``column`` as ``description``, with the placeholder read as NULL."""

    return f"NULLIF({column}, '{ILO_PLACEHOLDER_DESCRIPTION}') AS description"

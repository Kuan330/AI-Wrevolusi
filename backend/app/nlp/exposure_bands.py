from __future__ import annotations

from app.constants.exposure_types import ExposureType

# ILO GenAI Exposure v2.5 potential25 → four application tiers.
_POTENTIAL25_HUMAN = frozenset({"Not Exposed", "Minimal Exposure"})
_POTENTIAL25_AI_ASSISTED = frozenset({"Exposed: Gradient 1", "Exposed: Gradient 2"})
_POTENTIAL25_PARTLY = frozenset({"Exposed: Gradient 3"})
_POTENTIAL25_AUTOMATED = frozenset({"Exposed: Gradient 4"})

# Score fallback boundaries derived from tier medians in ilo_task_score_raw.csv.
_SCORE_HUMAN_MAX = 0.28
_SCORE_AI_ASSISTED_MAX = 0.43
_SCORE_PARTLY_MAX = 0.57


def band_from_potential25(potential25: str | None) -> str | None:
    if not potential25:
        return None
    label = potential25.strip()
    if label in _POTENTIAL25_HUMAN:
        return ExposureType.human_led.value
    if label in _POTENTIAL25_AI_ASSISTED:
        return ExposureType.ai_assisted.value
    if label in _POTENTIAL25_PARTLY:
        return ExposureType.partly_automated.value
    if label in _POTENTIAL25_AUTOMATED:
        return ExposureType.automated.value
    return None


def band_from_score(score: float | None) -> str:
    if score is None:
        return ExposureType.insufficient_data.value
    if score < _SCORE_HUMAN_MAX:
        return ExposureType.human_led.value
    if score < _SCORE_AI_ASSISTED_MAX:
        return ExposureType.ai_assisted.value
    if score < _SCORE_PARTLY_MAX:
        return ExposureType.partly_automated.value
    return ExposureType.automated.value


def resolve_exposure_band(
    *,
    score_2025: float | None = None,
    potential25: str | None = None,
) -> str:
    from_potential = band_from_potential25(potential25)
    if from_potential is not None:
        return from_potential
    return band_from_score(score_2025)


def band_from_catalog_metadata(metadata: dict) -> str:
    score = metadata.get("score_2025")
    potential25 = metadata.get("potential25")
    return resolve_exposure_band(
        score_2025=float(score) if score is not None else None,
        potential25=str(potential25) if potential25 else None,
    )


def potential25_from_metadata(metadata: dict) -> str | None:
    value = metadata.get("potential25")
    if not value:
        return None
    return str(value).strip() or None

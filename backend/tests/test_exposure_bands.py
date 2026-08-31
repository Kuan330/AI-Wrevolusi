from __future__ import annotations

from app.nlp.exposure_bands import (
    band_from_potential25,
    band_from_score,
    resolve_exposure_band,
)


def test_band_from_potential25_mapping() -> None:
    assert band_from_potential25("Not Exposed") == "human_led"
    assert band_from_potential25("Minimal Exposure") == "human_led"
    assert band_from_potential25("Exposed: Gradient 1") == "ai_assisted"
    assert band_from_potential25("Exposed: Gradient 2") == "ai_assisted"
    assert band_from_potential25("Exposed: Gradient 3") == "partly_automated"
    assert band_from_potential25("Exposed: Gradient 4") == "automated"
    assert band_from_potential25(None) is None
    assert band_from_potential25("unknown label") is None


def test_band_from_score_fallback_thresholds() -> None:
    assert band_from_score(None) == "insufficient_data"
    assert band_from_score(0.15) == "human_led"
    assert band_from_score(0.35) == "ai_assisted"
    assert band_from_score(0.50) == "partly_automated"
    assert band_from_score(0.65) == "automated"


def test_resolve_exposure_band_prefers_potential25() -> None:
    assert (
        resolve_exposure_band(score_2025=0.65, potential25="Minimal Exposure")
        == "human_led"
    )
    assert resolve_exposure_band(score_2025=0.65) == "automated"

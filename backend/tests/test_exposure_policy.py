from __future__ import annotations

import numpy as np

from app.nlp.catalogs import IloTaskCatalog
from app.nlp.index import MemoryIndex
from app.nlp.policies.exposure import ExposurePolicy, band_from_score
from app.nlp.retrieve import Retriever
from app.nlp.text import is_kept_ilo_edit, is_work_task, normalize_for_match
from app.nlp.types import CatalogItem


class StubEncoder:
    name = "stub"

    def __init__(self, table: dict[str, np.ndarray]) -> None:
        self.table = {key: np.asarray(value, dtype=np.float32) for key, value in table.items()}

    def encode_documents(self, texts: list[str]) -> np.ndarray:
        return np.stack([self.table[text] for text in texts])

    def encode_queries(self, texts: list[str]) -> np.ndarray:
        return np.stack([self.table[text] for text in texts])


INVENTORY_5221 = "Taking inventory of goods in stock."
INVENTORY_5222 = "Taking inventory of goods for sale and ordering new stock;"
STACKING = "Stacking and displaying goods for sale, and wrapping and packing goods sold."
PRICING = "Determining prices and displaying goods for sale;"
REWRITE_INVENTORY = "Taking inventory of goods in the shop"
REWRITE_STACKING = "Wrap and pack goods sold and stack them for display"
NOISE = "Coordinate a one-off community festival volunteer rota"


def _vec(*values: float) -> np.ndarray:
    array = np.asarray(values, dtype=np.float32)
    return array / np.linalg.norm(array)


def _item(isco: str, task_id: str, text: str, score: float) -> CatalogItem:
    return CatalogItem(
        catalog="ilo_tasks",
        item_id=f"{isco}:{task_id}",
        text=text,
        metadata={
            "isco_08": isco,
            "task_id": task_id,
            "score_2025": score,
            "match_key": normalize_for_match(text),
        },
    )


def _policy() -> ExposurePolicy:
    items = [
        _item("5221", "7", INVENTORY_5221, 0.3525),
        _item("5222", "6", INVENTORY_5222, 0.33),
        _item("5223", "5", STACKING, 0.1575),
        _item("5221", "4", PRICING, 0.39),
    ]
    catalog = IloTaskCatalog(items)
    table = {
        INVENTORY_5221: _vec(1, 0, 0, 0),
        INVENTORY_5222: _vec(0.96, 0.05, 0, 0),
        STACKING: _vec(0, 1, 0, 0),
        PRICING: _vec(0, 0, 1, 0),
        REWRITE_INVENTORY: _vec(0.98, 0.08, 0, 0),
        REWRITE_STACKING: _vec(0.04, 0.97, 0.18, 0),
        NOISE: _vec(0.4, 0.4, 0.4, 0.4),
    }
    encoder = StubEncoder(table)
    index = MemoryIndex(items, encoder.encode_documents([item.text for item in items]))
    return ExposurePolicy(
        catalog,
        Retriever(encoder, index),
        min_chars=12,
        occupation_min_sim=0.7,
        minor_min_sim=0.75,
        global_min_sim=0.82,
    )


def test_keyword_is_not_a_task() -> None:
    assert not is_work_task("prod")
    assert not is_work_task("hello")
    assert not is_work_task("do my job")
    estimate = _policy().estimate("prod", "5223")
    assert estimate.score_2025 is None
    assert estimate.reject_reason == "not_a_task"
    assert estimate.score_source == "unscored"


def test_shortened_ilo_is_a_work_task() -> None:
    assert is_work_task("Planning and preparing work schedules")
    assert is_work_task("Taking inventory of goods in the shop")


def test_exact_text_uses_same_occupation_score() -> None:
    estimate = _policy().estimate(INVENTORY_5221, "5221")
    assert estimate.match_layer == "exact"
    assert estimate.score_2025 == 0.3525
    assert estimate.band == "ai_assisted"


def test_inventory_rewrite_stays_in_original_band() -> None:
    estimate = _policy().estimate(REWRITE_INVENTORY, "5221")
    assert estimate.match_layer == "nlp"
    assert estimate.score_2025 is not None
    assert abs(estimate.score_2025 - 0.3525) < 0.02
    assert band_from_score(estimate.score_2025) == "ai_assisted"
    assert estimate.neighbors[0].isco_08 == "5221"


def test_stacking_rewrite_does_not_match_pricing_display() -> None:
    estimate = _policy().estimate(REWRITE_STACKING, "5223")
    assert estimate.score_2025 is not None
    assert estimate.neighbors[0].task_text == STACKING
    assert estimate.band == "human_led"
    assert estimate.score_2025 < 0.25


def test_occupation_filter_prefers_same_job() -> None:
    estimate = _policy().estimate(REWRITE_INVENTORY, "5221")
    assert estimate.neighbors[0].isco_08 == "5221"
    assert estimate.neighbors[0].score_2025 == 0.3525


def test_real_task_always_gets_occupation_neighbor() -> None:
    estimate = _policy().estimate(NOISE, "5223")
    assert estimate.score_2025 is not None
    assert estimate.score_source == "estimated"
    assert estimate.reject_reason is None
    assert estimate.neighbors[0].isco_08 == "5223"


SCHEDULE = "Planning and preparing work schedules and assigning staff to specific duties;"
SCHEDULE_SHORT = "Planning and preparing work schedules"


def test_kept_ilo_edit_detects_deleted_clause() -> None:
    assert is_kept_ilo_edit(SCHEDULE_SHORT, SCHEDULE)
    assert is_kept_ilo_edit(SCHEDULE, SCHEDULE)
    assert not is_kept_ilo_edit("Planning", SCHEDULE)
    assert not is_kept_ilo_edit("Wrap and pack goods sold and stack them for display", STACKING)


def test_deleted_ilo_clause_keeps_catalog_score() -> None:
    items = [
        _item("5222", "1", SCHEDULE, 0.525),
        _item("5222", "8", "Ensuring that safety procedures are enforced.", 0.1575),
    ]
    catalog = IloTaskCatalog(items)
    encoder = StubEncoder(
        {
            SCHEDULE: _vec(1, 0),
            "Ensuring that safety procedures are enforced.": _vec(0, 1),
        }
    )
    policy = ExposurePolicy(catalog, Retriever(encoder, MemoryIndex(items, encoder.encode_documents([item.text for item in items]))))
    estimate = policy.estimate(SCHEDULE_SHORT, "5222")
    assert estimate.match_layer == "nlp"
    assert estimate.score_source == "estimated"
    assert estimate.score_2025 == 0.525
    assert estimate.band == "partly_automated"
    assert estimate.neighbors[0].task_text == SCHEDULE

    via_original = policy.estimate(SCHEDULE_SHORT, "5222", original_task_text=SCHEDULE)
    assert via_original.score_2025 == 0.525
    assert via_original.score_source == "estimated"


def test_nearest_occupation_neighbor_score() -> None:
    items = [
        _item("5223", "1", "Task A about sales records", 0.4),
        _item("5223", "2", "Task B about sales records", 0.5),
    ]
    catalog = IloTaskCatalog(items)
    table = {
        "Task A about sales records": _vec(1, 0),
        "Task B about sales records": _vec(0.9, 0.1),
        "Update the shop sales records": _vec(0.95, 0.05),
    }
    encoder = StubEncoder(table)
    index = MemoryIndex(items, encoder.encode_documents([item.text for item in items]))
    policy = ExposurePolicy(
        catalog,
        Retriever(encoder, index),
        occupation_min_sim=0.7,
        minor_min_sim=0.9,
        global_min_sim=0.9,
    )
    estimate = policy.estimate("Update the shop sales records", "5223")
    assert estimate.match_layer == "nlp"
    assert estimate.score_2025 == 0.4
    assert len(estimate.neighbors) == 1
    assert estimate.neighbors[0].task_text == "Task A about sales records"

from __future__ import annotations

import csv
from pathlib import Path

from app.nlp.text import is_kept_ilo_edit, normalize_for_match
from app.nlp.types import CatalogItem


ILO_CATALOG = "ilo_tasks"


def load_ilo_task_catalog(csv_path: Path) -> list[CatalogItem]:
    items: list[CatalogItem] = []
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            text = (row.get("task_text") or "").strip()
            if not text:
                continue
            try:
                score = float(row["score_2025"])
            except (TypeError, ValueError, KeyError):
                continue
            isco = str(row.get("isco_08") or "").strip().zfill(4)
            task_id = str(row.get("task_id") or "").strip()
            items.append(
                CatalogItem(
                    catalog=ILO_CATALOG,
                    item_id=f"{isco}:{task_id}",
                    text=text,
                    metadata={
                        "isco_08": isco,
                        "task_id": task_id,
                        "title": row.get("title") or "",
                        "score_2025": score,
                        "match_key": normalize_for_match(text),
                    },
                )
            )
    return items


class IloTaskCatalog:
    def __init__(self, items: list[CatalogItem]) -> None:
        self.items = items
        self._by_key: dict[str, list[CatalogItem]] = {}
        for item in items:
            key = str(item.metadata.get("match_key") or "")
            self._by_key.setdefault(key, []).append(item)

    def exact_matches(self, text: str, occupation_code: str | None = None) -> list[CatalogItem]:
        matches = self._by_key.get(normalize_for_match(text), [])
        if occupation_code:
            same_job = [item for item in matches if item.metadata.get("isco_08") == occupation_code]
            if same_job:
                return same_job
        return list(matches)

    def lexical_matches(self, text: str, occupation_code: str | None = None) -> list[CatalogItem]:
        exact = self.exact_matches(text, occupation_code)
        if exact:
            return exact

        query_key = normalize_for_match(text)
        if not query_key:
            return []

        pool = self.items
        if occupation_code:
            same_job = [item for item in self.items if item.metadata.get("isco_08") == occupation_code]
            if same_job:
                pool = same_job
            else:
                minor = occupation_code[:3]
                pool = [
                    item
                    for item in self.items
                    if str(item.metadata.get("isco_08") or "").startswith(minor)
                ]

        hits = [item for item in pool if is_kept_ilo_edit(text, item.text)]
        hits.sort(key=lambda item: len(query_key) / max(len(str(item.metadata.get("match_key") or "")), 1), reverse=True)
        return hits

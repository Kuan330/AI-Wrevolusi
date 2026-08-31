from __future__ import annotations

from dataclasses import dataclass, field

from app.nlp.catalogs import IloTaskCatalog
from app.nlp.exposure_bands import band_from_catalog_metadata, band_from_score, potential25_from_metadata
from app.nlp.retrieve import Retriever
from app.nlp.text import is_kept_ilo_edit, is_work_task, normalize_for_match, normalize_text
from app.nlp.types import CatalogItem, Hit


@dataclass(frozen=True)
class Neighbor:
    isco_08: str
    task_id: str
    task_text: str
    score_2025: float
    similarity: float


@dataclass(frozen=True)
class ExposureEstimate:
    score_2025: float | None
    band: str
    potential25: str | None
    match_layer: str
    score_source: str
    neighbors: list[Neighbor] = field(default_factory=list)
    reject_reason: str | None = None


def unscored(*, reject_reason: str | None = None) -> ExposureEstimate:
    return ExposureEstimate(
        score_2025=None,
        band=band_from_score(None),
        potential25=None,
        match_layer="insufficient_data",
        score_source="unscored",
        neighbors=[],
        reject_reason=reject_reason,
    )


def _neighbor(item: CatalogItem, similarity: float) -> Neighbor:
    return Neighbor(
        isco_08=str(item.metadata.get("isco_08") or ""),
        task_id=str(item.metadata.get("task_id") or ""),
        task_text=item.text,
        score_2025=float(item.metadata["score_2025"]),
        similarity=round(float(similarity), 4),
    )


def _nearest_score(hits: list[Hit]) -> tuple[float, list[Neighbor]]:
    hit = hits[0]
    score = round(float(hit.item.metadata["score_2025"]), 4)
    return score, [_neighbor(hit.item, hit.similarity)]


class ExposurePolicy:
    def __init__(
        self,
        catalog: IloTaskCatalog,
        retriever: Retriever,
        *,
        min_chars: int = 12,
        retrieve_k: int = 5,
        occupation_min_sim: float = 0.55,
        minor_min_sim: float = 0.58,
        global_min_sim: float = 0.78,
    ) -> None:
        self.catalog = catalog
        self.retriever = retriever
        self.min_chars = min_chars
        self.retrieve_k = retrieve_k
        self.occupation_min_sim = occupation_min_sim
        self.minor_min_sim = minor_min_sim
        self.global_min_sim = global_min_sim

    def estimate(
        self,
        task_text: str,
        occupation_code: str,
        original_task_text: str | None = None,
    ) -> ExposureEstimate:
        text = normalize_text(task_text)
        occupation = (occupation_code or "").strip().zfill(4) if occupation_code else ""
        if not is_work_task(text, min_chars=self.min_chars):
            return unscored(reject_reason="not_a_task")

        if original_task_text and is_kept_ilo_edit(text, original_task_text):
            original_hits = self.catalog.exact_matches(original_task_text, occupation or None)
            if original_hits:
                item = original_hits[0]
                return ExposureEstimate(
                    score_2025=round(float(item.metadata["score_2025"]), 4),
                    band=band_from_catalog_metadata(item.metadata),
                    potential25=potential25_from_metadata(item.metadata),
                    match_layer="nlp",
                    score_source="estimated",
                    neighbors=[_neighbor(item, 1.0)],
                )

        lexical = self.catalog.lexical_matches(text, occupation or None)
        if lexical:
            item = lexical[0]
            same_sentence = normalize_for_match(text) == str(item.metadata.get("match_key") or "")
            return ExposureEstimate(
                score_2025=round(float(item.metadata["score_2025"]), 4),
                band=band_from_catalog_metadata(item.metadata),
                potential25=potential25_from_metadata(item.metadata),
                match_layer="exact" if same_sentence else "nlp",
                score_source="estimated",
                neighbors=[_neighbor(item, 1.0)],
            )

        query_vector = self.retriever.encoder.encode_queries([text])[0]
        occupation_hits = self.retriever.retrieve(
            text,
            k=self.retrieve_k,
            where=lambda item: item.metadata.get("isco_08") == occupation,
            query_vector=query_vector,
        )
        if occupation_hits:
            return self._from_neighbors(occupation_hits)

        minor = occupation[:3] if len(occupation) >= 3 else occupation
        if minor:
            minor_hits = self.retriever.retrieve(
                text,
                k=self.retrieve_k,
                where=lambda item: str(item.metadata.get("isco_08") or "").startswith(minor),
                query_vector=query_vector,
            )
            if minor_hits:
                return self._from_neighbors(minor_hits)

        global_hits = self.retriever.retrieve(text, k=self.retrieve_k, query_vector=query_vector)
        if global_hits:
            return self._from_neighbors(global_hits)

        return unscored(reject_reason="insufficient_data")

    def _from_neighbors(self, hits: list[Hit]) -> ExposureEstimate:
        hit = hits[0]
        score, neighbors = _nearest_score(hits)
        return ExposureEstimate(
            score_2025=score,
            band=band_from_catalog_metadata(hit.item.metadata),
            potential25=potential25_from_metadata(hit.item.metadata),
            match_layer="nlp",
            score_source="estimated",
            neighbors=neighbors,
        )

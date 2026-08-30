from __future__ import annotations

import numpy as np

from app.nlp.types import CatalogItem, Hit, WhereFilter


class MemoryIndex:
    def __init__(self, items: list[CatalogItem], vectors: np.ndarray) -> None:
        if len(items) != len(vectors):
            raise ValueError("items and vectors must have the same length")
        self.items = items
        self.vectors = np.asarray(vectors, dtype=np.float32)

    def search(
        self,
        vector: np.ndarray,
        k: int = 5,
        where: WhereFilter | None = None,
    ) -> list[Hit]:
        if self.vectors.size == 0 or k <= 0:
            return []
        query = np.asarray(vector, dtype=np.float32).reshape(-1)
        similarities = self.vectors @ query
        if where is not None:
            mask = np.array([where(item) for item in self.items], dtype=bool)
            similarities = np.where(mask, similarities, -1.0)
        eligible = int(np.sum(similarities > -1.0)) if where is not None else len(self.items)
        if eligible == 0:
            return []
        take = min(k, eligible, len(self.items))
        if take == 1:
            top = np.array([int(np.argmax(similarities))])
        else:
            partition = np.argpartition(-similarities, take - 1)[:take]
            top = partition[np.argsort(-similarities[partition])]
        hits: list[Hit] = []
        for index in top:
            score = float(similarities[index])
            if score <= -1.0:
                continue
            hits.append(Hit(item=self.items[int(index)], similarity=score))
        return hits

from __future__ import annotations

import numpy as np

from app.nlp.index import MemoryIndex
from app.nlp.types import EmbeddingEncoder, Hit, WhereFilter


class Retriever:
    def __init__(self, encoder: EmbeddingEncoder, index: MemoryIndex) -> None:
        self.encoder = encoder
        self.index = index

    def retrieve(
        self,
        query: str,
        k: int = 5,
        where: WhereFilter | None = None,
        query_vector: np.ndarray | None = None,
    ) -> list[Hit]:
        vector = query_vector if query_vector is not None else self.encoder.encode_queries([query])[0]
        return self.index.search(vector, k=k, where=where)

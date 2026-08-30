from __future__ import annotations

import hashlib

import numpy as np

from app.nlp.text import normalize_text


def l2_normalize(matrix: np.ndarray) -> np.ndarray:
    if matrix.size == 0:
        return matrix.astype(np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-12)
    return (matrix / norms).astype(np.float32)


class HashedNgramEncoder:
    """Stable character 3-gram hash encoder for tests and offline fallback."""

    def __init__(self, dim: int = 512, ngram: int = 3) -> None:
        self.name = f"hashed-char{ngram}-{dim}"
        self.dim = dim
        self.ngram = ngram

    def encode_documents(self, texts: list[str]) -> np.ndarray:
        return self._encode(texts)

    def encode_queries(self, texts: list[str]) -> np.ndarray:
        return self._encode(texts)

    def _encode(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, raw in enumerate(texts):
            padded = f"  {normalize_text(raw).casefold()}  "
            width = self.ngram
            if len(padded) < width:
                continue
            for index in range(len(padded) - width + 1):
                gram = padded[index : index + width]
                digest = hashlib.md5(gram.encode("utf-8")).digest()
                bucket = int.from_bytes(digest[:4], "little") % self.dim
                sign = 1.0 if digest[4] % 2 == 0 else -1.0
                out[row, bucket] += sign
        return l2_normalize(out)


class SentenceTransformerEncoder:
    """multilingual-e5 style encoder. Documents use passage: prefixes; queries use query:."""

    def __init__(self, model_name: str = "intfloat/multilingual-e5-small") -> None:
        from sentence_transformers import SentenceTransformer

        self.name = model_name
        self._model = SentenceTransformer(model_name)
        self._use_e5_prefix = "e5" in model_name.lower()

    def encode_documents(self, texts: list[str]) -> np.ndarray:
        payload = [f"passage: {text}" for text in texts] if self._use_e5_prefix else texts
        return self._encode(payload)

    def encode_queries(self, texts: list[str]) -> np.ndarray:
        payload = [f"query: {text}" for text in texts] if self._use_e5_prefix else texts
        return self._encode(payload)

    def _encode(self, texts: list[str]) -> np.ndarray:
        vectors = self._model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return np.asarray(vectors, dtype=np.float32)

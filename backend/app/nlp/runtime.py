from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.core.config import settings
from app.nlp.catalogs import IloTaskCatalog, load_ilo_task_catalog
from app.nlp.embeddings import HashedNgramEncoder, SentenceTransformerEncoder
from app.nlp.index import MemoryIndex
from app.nlp.policies.exposure import ExposurePolicy
from app.nlp.retrieve import Retriever
from app.nlp.types import EmbeddingEncoder


def index_filename(model_name: str) -> str:
    safe = model_name.replace("/", "-")
    return f"ilo_tasks_{safe}.npz"


@dataclass
class ExposureRuntime:
    encoder: EmbeddingEncoder
    catalog: IloTaskCatalog
    index: MemoryIndex
    retriever: Retriever
    policy: ExposurePolicy
    ready: bool
    backend: str


def _empty_runtime() -> ExposureRuntime:
    encoder = HashedNgramEncoder()
    catalog = IloTaskCatalog([])
    index = MemoryIndex([], np.zeros((0, 1), dtype=np.float32))
    retriever = Retriever(encoder, index)
    policy = ExposurePolicy(catalog, retriever)
    return ExposureRuntime(
        encoder=encoder,
        catalog=catalog,
        index=index,
        retriever=retriever,
        policy=policy,
        ready=False,
        backend="unavailable",
    )


def load_exposure_runtime() -> ExposureRuntime:
    try:
        csv_path = Path(settings.nlp_ilo_csv)
        if not csv_path.is_file():
            return _empty_runtime()

        items = load_ilo_task_catalog(csv_path)
        catalog = IloTaskCatalog(items)
        encoder, vectors, backend = _load_vectors(items)
        index = MemoryIndex(items, vectors)
        retriever = Retriever(encoder, index)
        policy = ExposurePolicy(
            catalog,
            retriever,
            min_chars=settings.nlp_exposure_min_chars,
            retrieve_k=settings.nlp_retrieve_k,
            occupation_min_sim=settings.nlp_exposure_min_sim,
            minor_min_sim=settings.nlp_exposure_minor_min_sim,
            global_min_sim=settings.nlp_exposure_global_min_sim,
        )
        return ExposureRuntime(
            encoder=encoder,
            catalog=catalog,
            index=index,
            retriever=retriever,
            policy=policy,
            ready=len(items) > 0,
            backend=backend,
        )
    except Exception:
        return _empty_runtime()


def _load_vectors(items: list) -> tuple[EmbeddingEncoder, np.ndarray, str]:
    npz_path = Path(settings.nlp_index_dir) / index_filename(settings.nlp_embedding_model)
    if npz_path.is_file():
        try:
            encoder = SentenceTransformerEncoder(settings.nlp_embedding_model)
            payload = np.load(npz_path, allow_pickle=False)
            vectors = np.asarray(payload["vectors"], dtype=np.float32)
            ids = payload["item_ids"].astype(str).tolist()
            expected = [item.item_id for item in items]
            if ids == expected and len(vectors) == len(items):
                return encoder, vectors, encoder.name
        except Exception:
            pass

    encoder = HashedNgramEncoder()
    vectors = encoder.encode_documents([item.text for item in items])
    return encoder, vectors, encoder.name


@lru_cache
def get_exposure_runtime() -> ExposureRuntime:
    return load_exposure_runtime()


def warmup_exposure_runtime() -> ExposureRuntime:
    get_exposure_runtime.cache_clear()
    return get_exposure_runtime()

"""Build a cached ILO embedding index.

Run from the backend directory:

  python -m app.nlp.build_ilo_index

Writes data/nlp/ilo_tasks_<model>.npz (gitignored).
Requires sentence-transformers and a network download of the model on first run.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

from app.core.config import settings
from app.nlp.catalogs import load_ilo_task_catalog
from app.nlp.embeddings import SentenceTransformerEncoder
from app.nlp.runtime import index_filename


def build_ilo_index() -> Path:
    csv_path = Path(settings.nlp_ilo_csv)
    if not csv_path.is_file():
        raise FileNotFoundError(csv_path)

    items = load_ilo_task_catalog(csv_path)
    if not items:
        raise RuntimeError(f"No ILO tasks loaded from {csv_path}")

    encoder = SentenceTransformerEncoder(settings.nlp_embedding_model)
    vectors = encoder.encode_documents([item.text for item in items])
    out_dir = Path(settings.nlp_index_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / index_filename(settings.nlp_embedding_model)
    np.savez(
        out_path,
        vectors=vectors,
        item_ids=np.array([item.item_id for item in items]),
        model=np.array(encoder.name),
    )
    print(f"Wrote {len(items)} vectors to {out_path}")
    return out_path


if __name__ == "__main__":
    build_ilo_index()

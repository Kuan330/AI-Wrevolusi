from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import Pipeline

TASK_EXPOSURE_MODEL_ARTIFACT_VERSION = 'epic2-tfidf-ridge-v1'
TASK_EXPOSURE_MODEL_TYPE = 'scikit_learn_tfidf_ridge_regression'
TASK_EXPOSURE_MODEL_ARTIFACT_PATH = (
    Path(__file__).resolve().parents[1]
    / 'model_artifacts'
    / 'epic2_task_exposure_tfidf_ridge_v1.joblib'
)


@dataclass(frozen=True)
class TrainedTaskExposureScorePrediction:
    predicted_score_2025: float
    model_version: str
    model_type: str


def validate_trusted_task_exposure_model_artifact(artifact: dict[str, Any]) -> None:
    required_fields = {'artifact_version', 'pipeline', 'training_metrics', 'dataset_sha256'}
    missing_fields = sorted(required_fields - artifact.keys())
    if missing_fields:
        raise RuntimeError(f'Task exposure model artifact is missing fields: {missing_fields}')
    if artifact['artifact_version'] != TASK_EXPOSURE_MODEL_ARTIFACT_VERSION:
        raise RuntimeError(
            'Task exposure model artifact version mismatch: '
            f"expected {TASK_EXPOSURE_MODEL_ARTIFACT_VERSION}, "
            f"received {artifact['artifact_version']}"
        )
    if not isinstance(artifact['pipeline'], Pipeline):
        raise RuntimeError('Task exposure model artifact does not contain a scikit-learn Pipeline.')


@lru_cache(maxsize=1)
def load_trusted_task_exposure_model_artifact() -> dict[str, Any]:
    if not TASK_EXPOSURE_MODEL_ARTIFACT_PATH.exists():
        raise RuntimeError(
            f'Task exposure model artifact not found: {TASK_EXPOSURE_MODEL_ARTIFACT_PATH}'
        )
    # joblib can execute code while loading. This path is fixed to the reviewed,
    # repository-bundled artifact and must never be replaced with user input.
    artifact = joblib.load(TASK_EXPOSURE_MODEL_ARTIFACT_PATH)
    if not isinstance(artifact, dict):
        raise RuntimeError('Task exposure model artifact must be a dictionary bundle.')
    validate_trusted_task_exposure_model_artifact(artifact)
    return artifact


def predict_task_exposure_score_with_trained_text_model(
    task_text: str,
) -> TrainedTaskExposureScorePrediction:
    artifact = load_trusted_task_exposure_model_artifact()
    pipeline: Pipeline = artifact['pipeline']
    predicted_score = float(pipeline.predict([task_text])[0])
    return TrainedTaskExposureScorePrediction(
        predicted_score_2025=min(1.0, max(0.0, predicted_score)),
        model_version=artifact['artifact_version'],
        model_type=TASK_EXPOSURE_MODEL_TYPE,
    )


def calculate_reference_task_cosine_similarities_with_trained_vectorizer(
    task_text: str,
    reference_task_texts: list[str],
) -> list[float]:
    if not reference_task_texts:
        return []
    artifact = load_trusted_task_exposure_model_artifact()
    pipeline: Pipeline = artifact['pipeline']
    task_text_vectorizer = pipeline.named_steps['task_text_vectorizer']
    task_vector = task_text_vectorizer.transform([task_text])
    reference_task_vectors = task_text_vectorizer.transform(reference_task_texts)
    return cosine_similarity(task_vector, reference_task_vectors)[0].tolist()

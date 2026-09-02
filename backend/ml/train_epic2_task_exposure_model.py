import argparse
import csv
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.linear_model import Ridge
from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

TASK_EXPOSURE_MODEL_ARTIFACT_VERSION = 'epic2-tfidf-ridge-v1'


@dataclass(frozen=True)
class TaskExposureTrainingDataset:
    task_texts: list[str]
    exposure_scores: np.ndarray
    occupation_groups: list[str]


def load_task_exposure_training_dataset(dataset_path: Path) -> TaskExposureTrainingDataset:
    with dataset_path.open(newline='', encoding='utf-8') as dataset_file:
        valid_rows = [
            row
            for row in csv.DictReader(dataset_file)
            if row.get('task_text', '').strip() and row.get('score_2025', '').strip()
        ]
    if not valid_rows:
        raise ValueError(f'No labelled task rows found in {dataset_path}')
    return TaskExposureTrainingDataset(
        task_texts=[row['task_text'].strip() for row in valid_rows],
        exposure_scores=np.array([float(row['score_2025']) for row in valid_rows]),
        occupation_groups=[row['isco_08'] for row in valid_rows],
    )


def create_task_exposure_score_prediction_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            (
                'task_text_vectorizer',
                TfidfVectorizer(
                    lowercase=True,
                    stop_words='english',
                    ngram_range=(1, 2),
                    min_df=2,
                    max_df=0.98,
                    sublinear_tf=True,
                ),
            ),
            ('exposure_score_regressor', Ridge(alpha=1.0)),
        ]
    )


def map_exposure_scores_to_product_states(exposure_scores: np.ndarray) -> np.ndarray:
    return np.select(
        [exposure_scores < 0.25, exposure_scores < 0.4, exposure_scores < 0.55],
        ['human_led', 'ai_assisted', 'partly_automated'],
        default='reshaped',
    )


def calculate_grouped_cross_validation_metrics(
    training_dataset: TaskExposureTrainingDataset,
) -> dict[str, float]:
    grouped_cross_validation = GroupKFold(n_splits=5)
    predicted_scores = cross_val_predict(
        create_task_exposure_score_prediction_pipeline(),
        training_dataset.task_texts,
        training_dataset.exposure_scores,
        groups=training_dataset.occupation_groups,
        cv=grouped_cross_validation,
        n_jobs=-1,
    )
    mean_baseline_scores = np.full_like(
        training_dataset.exposure_scores,
        training_dataset.exposure_scores.mean(),
    )
    actual_states = map_exposure_scores_to_product_states(training_dataset.exposure_scores)
    predicted_states = map_exposure_scores_to_product_states(predicted_scores)
    return {
        'grouped_cross_validation_mean_absolute_error': float(
            mean_absolute_error(training_dataset.exposure_scores, predicted_scores)
        ),
        'grouped_cross_validation_root_mean_squared_error': float(
            np.sqrt(mean_squared_error(training_dataset.exposure_scores, predicted_scores))
        ),
        'grouped_cross_validation_r2': float(
            r2_score(training_dataset.exposure_scores, predicted_scores)
        ),
        'grouped_cross_validation_macro_f1': float(
            f1_score(actual_states, predicted_states, average='macro')
        ),
        'mean_score_baseline_mean_absolute_error': float(
            mean_absolute_error(training_dataset.exposure_scores, mean_baseline_scores)
        ),
        'mean_score_baseline_root_mean_squared_error': float(
            np.sqrt(mean_squared_error(training_dataset.exposure_scores, mean_baseline_scores))
        ),
    }


def calculate_file_sha256(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open('rb') as source_file:
        for chunk in iter(lambda: source_file.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def calculate_robustness_and_gender_wording_probe_metrics(
    trained_pipeline: Pipeline,
) -> dict[str, float]:
    representative_task_texts = [
        'Prepare staff work schedules and assign duties for each shift.',
        'Advise customers about products and resolve complex service problems.',
        'Review inventory records and order replacement stock.',
    ]
    original_scores = trained_pipeline.predict(representative_task_texts)
    formatting_variants = [
        re.sub(r'[^A-Z0-9 ]', '', task_text.upper()) for task_text in representative_task_texts
    ]
    formatting_variant_scores = trained_pipeline.predict(formatting_variants)
    woman_wording_scores = trained_pipeline.predict(
        [f'A woman performs this task: {task_text}' for task_text in representative_task_texts]
    )
    man_wording_scores = trained_pipeline.predict(
        [f'A man performs this task: {task_text}' for task_text in representative_task_texts]
    )
    return {
        'formatting_variant_max_absolute_score_difference': float(
            np.max(np.abs(original_scores - formatting_variant_scores))
        ),
        'gender_wording_max_absolute_score_difference': float(
            np.max(np.abs(woman_wording_scores - man_wording_scores))
        ),
    }


def train_and_write_task_exposure_model_artifact(
    dataset_path: Path,
    artifact_path: Path,
    metrics_path: Path,
) -> dict[str, object]:
    training_dataset = load_task_exposure_training_dataset(dataset_path)
    training_metrics = calculate_grouped_cross_validation_metrics(training_dataset)
    if (
        training_metrics['grouped_cross_validation_mean_absolute_error']
        >= training_metrics['mean_score_baseline_mean_absolute_error']
    ):
        raise RuntimeError('Trained model did not outperform the mean-score MAE baseline.')

    task_exposure_prediction_pipeline = create_task_exposure_score_prediction_pipeline()
    task_exposure_prediction_pipeline.fit(
        training_dataset.task_texts,
        training_dataset.exposure_scores,
    )
    robustness_and_bias_probe_metrics = calculate_robustness_and_gender_wording_probe_metrics(
        task_exposure_prediction_pipeline
    )
    if training_metrics['grouped_cross_validation_macro_f1'] < 0.45:
        raise RuntimeError('Trained model did not meet the 0.45 grouped macro-F1 promotion gate.')
    if robustness_and_bias_probe_metrics['gender_wording_max_absolute_score_difference'] > 0.02:
        raise RuntimeError('Trained model exceeded the gender-wording score-difference guardrail.')
    artifact = {
        'artifact_version': TASK_EXPOSURE_MODEL_ARTIFACT_VERSION,
        'model_type': 'scikit_learn_tfidf_ridge_regression',
        'trained_at_utc': datetime.now(UTC).isoformat(),
        'training_dataset': 'data/raw/ilo_task_score_raw.csv',
        'dataset_sha256': calculate_file_sha256(dataset_path),
        'training_row_count': len(training_dataset.task_texts),
        'training_occupation_group_count': len(set(training_dataset.occupation_groups)),
        'training_metrics': training_metrics,
        'robustness_and_bias_probe_metrics': robustness_and_bias_probe_metrics,
        'training_library': f'scikit-learn {sklearn.__version__}',
        'training_configuration': {
            'vectorizer': 'TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_df=0.98)',
            'regressor': 'Ridge(alpha=1.0)',
            'cross_validation': 'GroupKFold(n_splits=5, groups=isco_08)',
        },
        'pipeline': task_exposure_prediction_pipeline,
    }
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, artifact_path, compress=3)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(
        json.dumps({key: value for key, value in artifact.items() if key != 'pipeline'}, indent=2),
        encoding='utf-8',
    )
    return artifact


def parse_command_line_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description='Train and evaluate the Epic 2 exposure model.')
    parser.add_argument(
        '--dataset',
        type=Path,
        default=repository_root / 'data' / 'raw' / 'ilo_task_score_raw.csv',
    )
    parser.add_argument(
        '--artifact',
        type=Path,
        default=(
            repository_root
            / 'backend'
            / 'app'
            / 'model_artifacts'
            / 'epic2_task_exposure_tfidf_ridge_v1.joblib'
        ),
    )
    parser.add_argument(
        '--metrics',
        type=Path,
        default=(
            repository_root
            / 'backend'
            / 'app'
            / 'model_artifacts'
            / 'epic2_task_exposure_tfidf_ridge_v1.metrics.json'
        ),
    )
    return parser.parse_args()


def main() -> None:
    arguments = parse_command_line_arguments()
    artifact = train_and_write_task_exposure_model_artifact(
        dataset_path=arguments.dataset.resolve(),
        artifact_path=arguments.artifact.resolve(),
        metrics_path=arguments.metrics.resolve(),
    )
    print(json.dumps({key: value for key, value in artifact.items() if key != 'pipeline'}, indent=2))


if __name__ == '__main__':
    main()

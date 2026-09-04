import argparse
import csv
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

import sklearn

from app.ml.capability_text_matcher import (
    CAPABILITY_TEXT_MATCHER_TYPE,
    CAPABILITY_TEXT_MATCHER_VERSION,
    MAXIMUM_CAPABILITIES_PER_TASK,
    MINIMUM_CAPABILITY_SIMILARITY,
    WefCapabilityProfile,
    match_task_texts_to_wef_capability_profiles,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_WEF_PROFILE_PATH = REPOSITORY_ROOT / 'data' / 'reference' / 'ref_wef_skills.csv'
DEFAULT_OUTPUT_PATH = (
    REPOSITORY_ROOT
    / 'backend'
    / 'app'
    / 'model_artifacts'
    / 'epic3_wef_tfidf_cosine_v1.metrics.json'
)


@dataclass(frozen=True)
class CapabilityEvaluationExample:
    task_text: str
    expected_capability_names: frozenset[str]


EVALUATION_EXAMPLES = [
    CapabilityEvaluationExample(
        'Ensure customers receive prompt service and listen to their needs',
        frozenset({'Service orientation and customer service', 'Empathy and active listening'}),
    ),
    CapabilityEvaluationExample(
        'Advise shoppers on products and resolve customer complaints patiently',
        frozenset({'Service orientation and customer service', 'Empathy and active listening'}),
    ),
    CapabilityEvaluationExample(
        'Train sales staff and coach them through difficult cases',
        frozenset({'Teaching and mentoring', 'Talent management'}),
    ),
    CapabilityEvaluationExample(
        'Interview new employees and evaluate staff performance',
        frozenset({'Talent management'}),
    ),
    CapabilityEvaluationExample(
        'Prepare work schedules and assign staff to each shop duty',
        frozenset({'Leadership and social influence', 'Resource management and operations'}),
    ),
    CapabilityEvaluationExample(
        'Coordinate shop operations and supervise shift assignments',
        frozenset({'Leadership and social influence', 'Resource management and operations'}),
    ),
    CapabilityEvaluationExample(
        'Take inventory and order replacement stock from suppliers',
        frozenset({'Resource management and operations', 'Dependability and attention to detail'}),
    ),
    CapabilityEvaluationExample(
        'Maintain accurate stock records and check inventory levels',
        frozenset({'Resource management and operations', 'Dependability and attention to detail'}),
    ),
    CapabilityEvaluationExample(
        'Prepare budgets and keep financial transaction records',
        frozenset({'Reading, writing and mathematics', 'Analytical thinking'}),
    ),
    CapabilityEvaluationExample(
        'Calculate prices and process invoices and customer payments',
        frozenset({'Reading, writing and mathematics', 'Analytical thinking'}),
    ),
    CapabilityEvaluationExample(
        'Inspect workplace safety and product quality procedures',
        frozenset({'Quality control', 'Dependability and attention to detail'}),
    ),
    CapabilityEvaluationExample(
        'Review returned goods and take appropriate corrective action',
        frozenset({'Quality control', 'Systems thinking'}),
    ),
    CapabilityEvaluationExample(
        'Determine the product mix, prices and in-store displays',
        frozenset({'Analytical thinking', 'Design and user experience'}),
    ),
    CapabilityEvaluationExample(
        'Arrange product displays to improve the shopper experience',
        frozenset({'Design and user experience'}),
    ),
    CapabilityEvaluationExample(
        'Wrap, pack and stack goods carefully on shelves',
        frozenset({'Manual dexterity, endurance and precision', 'Dependability and attention to detail'}),
    ),
    CapabilityEvaluationExample(
        'Tune guitars and perform songs at a wedding',
        frozenset(),
    ),
]

ROBUSTNESS_TASKS = [
    'Ensure customers receive prompt service and listen to their needs',
    'Prepare work schedules and assign staff to each shop duty',
    'Take inventory and order replacement stock from suppliers',
]

MISSPELLING_EXAMPLES = [
    CapabilityEvaluationExample(
        'Help custmers and provide promt service',
        frozenset({'Service orientation and customer service'}),
    ),
    CapabilityEvaluationExample(
        'Prepare staf work sheduals and assign duties',
        frozenset({'Leadership and social influence', 'Resource management and operations'}),
    ),
    CapabilityEvaluationExample(
        'Take inventry and order replacment stock',
        frozenset({'Resource management and operations'}),
    ),
]

MALAYSIAN_ENGLISH_EXAMPLES = [
    CapabilityEvaluationExample(
        'Attend to customers quickly and recommend suitable products',
        frozenset({'Service orientation and customer service', 'Empathy and active listening'}),
    ),
    CapabilityEvaluationExample(
        'Arrange the staff roster and coordinate the shop floor team',
        frozenset({'Leadership and social influence', 'Resource management and operations'}),
    ),
]

BAHASA_MALAYSIA_EXAMPLES = [
    CapabilityEvaluationExample(
        'Membantu pelanggan memilih produk dan memberi perkhidmatan dengan segera',
        frozenset({'Service orientation and customer service'}),
    ),
    CapabilityEvaluationExample(
        'Menyusun jadual pekerja dan menyelaras tugas di kedai',
        frozenset({'Leadership and social influence', 'Resource management and operations'}),
    ),
]


def load_wef_profiles(path: Path) -> list[WefCapabilityProfile]:
    with path.open(encoding='utf-8', newline='') as source:
        return [
            WefCapabilityProfile(
                wef_skill_id=int(row['wef_skill_id']),
                core_skill=row['core_skill'],
                wef_skill_group=row['wef_skill_group'] or None,
            )
            for row in csv.DictReader(source)
        ]


def calculate_metrics(
    examples: list[CapabilityEvaluationExample],
    profiles: list[WefCapabilityProfile],
    minimum_similarity: float = MINIMUM_CAPABILITY_SIMILARITY,
) -> dict[str, object]:
    matches_by_example = match_task_texts_to_wef_capability_profiles(
        [example.task_text for example in examples],
        profiles,
        minimum_similarity=minimum_similarity,
    )
    true_positive_count = 0
    predicted_count = 0
    expected_count = 0
    exact_match_count = 0
    negative_count = 0
    correct_abstention_count = 0

    for example, matches in zip(examples, matches_by_example):
        predicted = {match.profile.core_skill for match in matches}
        expected = set(example.expected_capability_names)
        true_positive_count += len(predicted & expected)
        predicted_count += len(predicted)
        expected_count += len(expected)
        exact_match_count += int(predicted == expected)
        if not expected:
            negative_count += 1
            correct_abstention_count += int(not predicted)

    precision = true_positive_count / predicted_count if predicted_count else 0.0
    recall = true_positive_count / expected_count if expected_count else 0.0
    return {
        'model_version': CAPABILITY_TEXT_MATCHER_VERSION,
        'model_type': CAPABILITY_TEXT_MATCHER_TYPE,
        'evaluation_example_count': len(examples),
        'positive_example_count': len(examples) - negative_count,
        'negative_example_count': negative_count,
        'minimum_similarity_threshold': minimum_similarity,
        'maximum_capabilities_per_task': MAXIMUM_CAPABILITIES_PER_TASK,
        'micro_precision_at_2': round(precision, 4),
        'micro_recall_at_2': round(recall, 4),
        'micro_f1_at_2': round(
            2 * precision * recall / (precision + recall) if precision + recall else 0.0,
            4,
        ),
        'exact_set_match_rate': round(exact_match_count / len(examples), 4),
        'negative_abstention_accuracy': round(
            correct_abstention_count / negative_count if negative_count else 0.0,
            4,
        ),
    }


def calculate_invariance_probe_metrics(
    profiles: list[WefCapabilityProfile],
) -> dict[str, float]:
    original_matches = match_task_texts_to_wef_capability_profiles(ROBUSTNESS_TASKS, profiles)
    formatting_matches = match_task_texts_to_wef_capability_profiles(
        [re.sub(r'[^A-Z0-9 ]', '', task.upper()) for task in ROBUSTNESS_TASKS],
        profiles,
    )
    woman_matches = match_task_texts_to_wef_capability_profiles(
        [f'A woman performs this task: {task}' for task in ROBUSTNESS_TASKS],
        profiles,
    )
    man_matches = match_task_texts_to_wef_capability_profiles(
        [f'A man performs this task: {task}' for task in ROBUSTNESS_TASKS],
        profiles,
    )

    def match_names(matches):
        return {match.profile.core_skill for match in matches}

    def similarity_by_name(matches):
        return {match.profile.core_skill: match.similarity for match in matches}

    gender_score_differences: list[float] = []
    for woman_task_matches, man_task_matches in zip(woman_matches, man_matches):
        woman_scores = similarity_by_name(woman_task_matches)
        man_scores = similarity_by_name(man_task_matches)
        for capability_name in woman_scores.keys() | man_scores.keys():
            gender_score_differences.append(
                abs(woman_scores.get(capability_name, 0.0) - man_scores.get(capability_name, 0.0))
            )

    return {
        'formatting_match_set_agreement_rate': round(
            sum(
                match_names(original) == match_names(formatting)
                for original, formatting in zip(original_matches, formatting_matches)
            )
            / len(ROBUSTNESS_TASKS),
            4,
        ),
        'gender_wording_match_set_agreement_rate': round(
            sum(
                match_names(woman) == match_names(man)
                for woman, man in zip(woman_matches, man_matches)
            )
            / len(ROBUSTNESS_TASKS),
            4,
        ),
        'gender_wording_max_returned_similarity_difference': round(
            max(gender_score_differences, default=0.0),
            4,
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Evaluate the Epic 3 TF-IDF capability matcher.')
    parser.add_argument('--wef-profiles', type=Path, default=DEFAULT_WEF_PROFILE_PATH)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()

    profiles = load_wef_profiles(args.wef_profiles)
    metrics = calculate_metrics(EVALUATION_EXAMPLES, profiles)
    evaluation_examples_json = json.dumps(
        [
            {
                'task_text': example.task_text,
                'expected_capability_names': sorted(example.expected_capability_names),
            }
            for example in EVALUATION_EXAMPLES
        ],
        sort_keys=True,
    )
    metrics['scikit_learn_version'] = sklearn.__version__
    metrics['wef_profile_dataset_sha256'] = hashlib.sha256(
        args.wef_profiles.read_bytes()
    ).hexdigest()
    metrics['evaluation_examples_sha256'] = hashlib.sha256(
        evaluation_examples_json.encode('utf-8')
    ).hexdigest()
    metrics['vectorizer_configuration'] = {
        'lowercase': True,
        'stop_words': 'english',
        'ngram_range': [1, 2],
        'sublinear_tf': True,
        'norm': 'l2',
    }
    metrics['evaluation_set_note'] = (
        'Small team-authored retail pilot sanity set; aliases and examples were created '
        'in the same iteration, so these metrics are not independent generalisation evidence.'
    )
    metrics['robustness_and_bias_probes'] = calculate_invariance_probe_metrics(profiles)
    metrics['misspelling_slice'] = calculate_metrics(MISSPELLING_EXAMPLES, profiles)
    metrics['malaysian_english_slice'] = calculate_metrics(
        MALAYSIAN_ENGLISH_EXAMPLES,
        profiles,
    )
    metrics['bahasa_malaysia_slice'] = calculate_metrics(
        BAHASA_MALAYSIA_EXAMPLES,
        profiles,
    )
    metrics['threshold_sweep'] = [
        calculate_metrics(EVALUATION_EXAMPLES, profiles, minimum_similarity=threshold)
        for threshold in (0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.25)
    ]
    promotion_gate_passed = (
        metrics['micro_precision_at_2'] >= 0.85
        and metrics['micro_recall_at_2'] >= 0.80
        and metrics['negative_abstention_accuracy'] >= 0.90
    )
    metrics['pilot_promotion_gate'] = {
        'minimum_micro_precision_at_2': 0.85,
        'minimum_micro_recall_at_2': 0.80,
        'minimum_negative_abstention_accuracy': 0.90,
    }
    metrics['pilot_promotion_gate_status'] = 'pass' if promotion_gate_passed else 'fail'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(metrics, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(metrics, indent=2))
    if not promotion_gate_passed:
        raise SystemExit('Epic 3 capability matcher failed the declared pilot promotion gate.')


if __name__ == '__main__':
    main()

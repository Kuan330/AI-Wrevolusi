from app.constants.exposure_types import ExposureType


def infer_exposure_state(task_text: str) -> tuple[ExposureType, float, str]:
    normalized = task_text.lower()

    reshaped_keywords = ['strategy', 'planning', 'cross-team', 'coach']
    automated_keywords = ['report', 'data entry', 'spreadsheet', 'email sorting']
    assisted_keywords = ['draft', 'review', 'summarise', 'support']

    if any(keyword in normalized for keyword in reshaped_keywords):
        return (
            ExposureType.reshaped,
            0.72,
            'Task likely shifts toward judgement and orchestration with AI co-work.',
        )

    if any(keyword in normalized for keyword in automated_keywords):
        return (
            ExposureType.partly_automated,
            0.78,
            'Task includes routine steps that can be automated, while validation stays human-led.',
        )

    if any(keyword in normalized for keyword in assisted_keywords):
        return (
            ExposureType.ai_assisted,
            0.64,
            'Task can be accelerated by AI suggestions but still needs human review.',
        )

    if len(normalized.strip()) < 8:
        return (
            ExposureType.insufficient_data,
            0.2,
            'Not enough task context to infer exposure reliably.',
        )

    return (
        ExposureType.human_led,
        0.58,
        'Task appears to rely on context-heavy interpersonal judgement.',
    )

# Task-to-Skill Inference Business Rules

Status: Approved for the first implementation

This document defines the product rules for inferring a user's capabilities from their work tasks and mapping those capabilities to the 26 World Economic Forum (WEF) core skills.

## 1. Product objective

The system translates a user's real work into professional skill language. It analyses each task, identifies the WEF skills that the task demonstrates or requires, and automatically includes those in an AI-inferred capability profile.

The system should say:

> Based on your work tasks, you appear to use these skills.

It must not claim, from a task description alone, that the user has mastered a skill. Skill identification and skill proficiency are separate judgments.

## 2. Task input

Each task must have:

- `task_id`
- `title`

The following fields are recommended when available:

- `description`
- `occupation`

The following fields are optional and support later proficiency assessment:

- `frequency`
- `autonomy`
- `complexity`
- `outcome`
- `tools`

The system may analyse a title-only task, but it must return insufficient context instead of forcing a skill match when the task is too vague.

## 3. Task-to-skill mapping

1. One task may map to multiple skills.
2. One task may return zero skills when evidence is insufficient.
3. A task may return no more than three primary skill results in the first implementation.
4. Every result must use one of the fixed 26 WEF core skill IDs.
5. The model must not create new official skill labels.
6. Matching must be based on the capability required or demonstrated by the task, not keyword presence alone.
7. Every returned skill must be supported by evidence from the task text or supplied task context.
8. Semantically similar skills must not be returned unless each has distinct supporting evidence.
9. The same skill must not be duplicated for the same task and inference version.

## 4. Inference output

Each task-skill result must store:

- `task_id`
- `wef_skill_id`
- `skill_name`
- `relevance` (`primary` or `supporting`)
- `confidence`
- `evidence`
- `explanation`
- `source` (`ai_inferred`)
- `model_name`
- `model_version`
- `inference_version`
- `created_at`

Example:

```json
{
  "task_id": "task-123",
  "wef_skill_id": 1,
  "skill_name": "Analytical thinking",
  "relevance": "primary",
  "confidence": 0.89,
  "evidence": "Analyse monthly sales changes and explain unusual results",
  "explanation": "The task requires identifying patterns, detecting anomalies, and explaining them using evidence.",
  "source": "ai_inferred",
  "model_name": "configured-model",
  "model_version": "configured-version",
  "inference_version": 1
}
```

## 5. Confidence

`confidence` measures confidence in the task-to-skill relationship. It is not a measure of the user's proficiency.

Internally, results may be grouped as:

- High confidence: clearly displayed as an identified skill.
- Medium confidence: displayed as a possible skill.
- Low confidence: excluded from the primary results.
- Insufficient context: no skill is recommended.

Numeric thresholds must not be fixed until they are calibrated against human-labelled task data. The user-facing interface should prefer plain-language labels such as `Identified` and `Possible` over unexplained decimal scores.

## 6. User interaction and feedback

User confirmation is not required before an AI-inferred skill appears in the capability profile. The product's purpose is to help users discover skills they may not recognise or know how to name.

Users may optionally:

- Mark an inference as relevant.
- Mark an inference as not representative of their actual work.
- Add a missing WEF skill.
- Correct or expand the task description.

AI inference and user feedback must be stored separately. User feedback must not overwrite the original model output.

Recommended states are:

- `inferred`: identified automatically by the system.
- `supported`: supported by multiple tasks or positive user feedback.
- `disputed`: marked by the user as not representative.
- `user_added`: added directly by the user.

A disputed result remains available for audit and model evaluation but is excluded from the active capability summary. A lack of user feedback must not block or remove an inference.

## 7. Capability aggregation

Multiple tasks may support the same WEF skill. The capability profile must show one skill with multiple task evidence records rather than duplicate capability entries.

Capability support may consider:

- Number of supporting tasks.
- Task frequency.
- User autonomy.
- Task complexity.
- Demonstrated outcomes.
- Diversity of supporting task contexts.
- Positive or negative user feedback.

Model confidence alone must not be used as a proficiency score.

The first implementation uses the following conceptual levels:

- `identified`: at least one task provides evidence for the skill.
- `regularly_used`: multiple tasks or recurring work provide evidence.
- `independently_applied`: the user reports independent application.
- `strength`: repeated independent application in complex work with outcome evidence.

Task title and description alone may support `identified` or `regularly_used`. `Independently applied` and `strength` require additional evidence about autonomy, complexity, and outcomes.

## 8. Reprocessing and versioning

Reprocessing is required when:

- The task title or description changes.
- Relevant task context changes.
- The WEF skill definition set changes.
- The inference model or prompt version changes.

Reprocessing must:

- Preserve prior predictions.
- Create a new inference version.
- Avoid duplicate task-skill records within the new version.
- Preserve user feedback and its link to the prediction it evaluated.
- Avoid silently restoring a disputed skill to the active profile without new evidence or an explicit policy decision.

## 9. Items pending calibration

The following values are intentionally not fixed in this business-rule version:

- Minimum confidence required to display a skill.
- Boundaries between high, medium, and low confidence.
- Evidence counts required for `regularly_used`.
- Evidence requirements for `strength`.

These values must be calibrated using representative, human-labelled tasks and validated with real user feedback.


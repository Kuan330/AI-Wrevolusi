import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.exposure_types import ExposureType
from app.ml.capability_text_matcher import (
    CAPABILITY_TEXT_MATCHER_TYPE,
    CAPABILITY_TEXT_MATCHER_VERSION,
    WefCapabilityProfile,
    match_task_texts_to_wef_capability_profiles,
)
from app.models.capability import Capability, CapabilityEvolution
from app.repositories.capabilities import CapabilityRepository
from app.repositories.tasks import TaskRepository
from app.schemas.capability import (
    CapabilityRecognitionTaskEvidence,
    ConfirmedTaskCapabilityRecognitionBatchRequest,
    ConfirmedTaskCapabilityRecognitionBatchResponse,
    RecognizedWefCapability,
)

WEF_CAPABILITY_SOURCE_NAME = 'World Economic Forum Future of Jobs Report 2025'
WEF_CAPABILITY_SOURCE_YEAR = '2025'


def suggest_capability_evolution_from_task_exposure_states(
    exposure_states: list[ExposureType | None],
) -> CapabilityEvolution | None:
    known_states = {state for state in exposure_states if state is not None}
    if ExposureType.reshaped in known_states:
        return CapabilityEvolution.needs_updating
    if known_states.intersection({ExposureType.ai_assisted, ExposureType.partly_automated}):
        return CapabilityEvolution.needs_strengthening
    if ExposureType.human_led in known_states:
        return CapabilityEvolution.continue_to_be_useful
    return None


async def load_wef_capability_profiles(
    db: AsyncSession,
) -> list[WefCapabilityProfile]:
    result = await db.execute(
        text(
            'SELECT wef_skill_id, core_skill, wef_skill_group '
            'FROM ref_wef_skills ORDER BY wef_skill_id'
        )
    )
    return [
        WefCapabilityProfile(
            wef_skill_id=int(row['wef_skill_id']),
            core_skill=str(row['core_skill']),
            wef_skill_group=(
                str(row['wef_skill_group']) if row['wef_skill_group'] is not None else None
            ),
        )
        for row in result.mappings().all()
    ]


async def recognize_capabilities_from_confirmed_tasks(
    db: AsyncSession,
    request: ConfirmedTaskCapabilityRecognitionBatchRequest,
) -> ConfirmedTaskCapabilityRecognitionBatchResponse:
    capability_profiles = await load_wef_capability_profiles(db)
    task_matches = match_task_texts_to_wef_capability_profiles(
        [task.task_text for task in request.confirmed_tasks],
        capability_profiles,
    )
    evidence_by_skill_id: dict[int, list[CapabilityRecognitionTaskEvidence]] = {}
    profile_by_skill_id = {
        profile.wef_skill_id: profile for profile in capability_profiles
    }
    unmatched_task_ids: list[str] = []

    for task, matches in zip(request.confirmed_tasks, task_matches):
        if not matches:
            unmatched_task_ids.append(task.task_id)
            continue
        for match in matches:
            evidence_by_skill_id.setdefault(match.profile.wef_skill_id, []).append(
                CapabilityRecognitionTaskEvidence(
                    task_id=task.task_id,
                    task_text=task.task_text,
                    exposure_state=task.exposure_state,
                    similarity=round(match.similarity, 4),
                )
            )

    recognized_capabilities: list[RecognizedWefCapability] = []
    for skill_id, task_evidence in evidence_by_skill_id.items():
        profile = profile_by_skill_id[skill_id]
        strongest_similarity = max(item.similarity for item in task_evidence)
        suggested_evolution = suggest_capability_evolution_from_task_exposure_states(
            [item.exposure_state for item in task_evidence]
        )
        producing_task_count = len({item.task_id for item in task_evidence})
        recognized_capabilities.append(
            RecognizedWefCapability(
                wef_skill_id=profile.wef_skill_id,
                core_skill=profile.core_skill,
                wef_skill_group=profile.wef_skill_group,
                suggested_evolution=suggested_evolution,
                strongest_similarity=round(strongest_similarity, 4),
                model_version=CAPABILITY_TEXT_MATCHER_VERSION,
                model_type=CAPABILITY_TEXT_MATCHER_TYPE,
                source_name=WEF_CAPABILITY_SOURCE_NAME,
                source_year=WEF_CAPABILITY_SOURCE_YEAR,
                reasoning=(
                    f'TF-IDF cosine similarity linked {producing_task_count} confirmed '
                    f'task(s) to the reviewed WEF capability profile. The strongest '
                    f'text similarity was {strongest_similarity:.2f}. Any evolution '
                    'wording is a transparent rule derived from the linked Epic 2 states.'
                ),
                uncertainty=(
                    'Cosine similarity measures wording overlap in the reviewed vocabulary; '
                    'it is not a calibrated probability that the user possesses the capability.'
                ),
                limitations=(
                    'This suggestion requires user confirmation and is not a professional '
                    'assessment, readiness score, or certification.'
                ),
                confirmation_status='requires_user_confirmation',
                task_evidence=sorted(
                    task_evidence,
                    key=lambda item: (-item.similarity, item.task_id),
                ),
            )
        )

    recognized_capabilities.sort(
        key=lambda capability: (
            -capability.strongest_similarity,
            capability.wef_skill_id,
        )
    )
    return ConfirmedTaskCapabilityRecognitionBatchResponse(
        capabilities=recognized_capabilities,
        unmatched_task_ids=unmatched_task_ids,
    )


class CapabilityService:
    @staticmethod
    async def list_capabilities(db: AsyncSession, user_id: uuid.UUID) -> list[Capability]:
        return await CapabilityRepository.list_by_user(db, user_id)

    @staticmethod
    async def infer_from_tasks(db: AsyncSession, user_id: uuid.UUID) -> list[Capability]:
        tasks = await TaskRepository.list_by_user(db, user_id)
        inferred: list[Capability] = []

        for task in tasks:
            title = task.title.lower()
            if 'customer' in title:
                inferred.append(
                    Capability(
                        user_id=user_id,
                        name='Customer interaction',
                        evolution=CapabilityEvolution.continue_to_be_useful,
                        evidence=[{'task_id': str(task.id), 'reason': task.title}],
                    )
                )
            if 'report' in title:
                inferred.append(
                    Capability(
                        user_id=user_id,
                        name='Reporting literacy',
                        evolution=CapabilityEvolution.needs_updating,
                        evidence=[{'task_id': str(task.id), 'reason': task.title}],
                    )
                )

        if inferred:
            db.add_all(inferred)
            await db.commit()
            for capability in inferred:
                await db.refresh(capability)

        return inferred

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.capability import Capability, CapabilityEvolution
from app.repositories.capabilities import CapabilityRepository
from app.repositories.tasks import TaskRepository


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

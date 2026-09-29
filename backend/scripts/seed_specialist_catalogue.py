"""Import the complete pinned ESCO release after `alembic upgrade head`.

From backend: python -m scripts.seed_specialist_catalogue --validate-only
To import into your configured database: python -m scripts.seed_specialist_catalogue
No network calls. All tables and release readiness commit atomically. A release
with different content is rejected; use a separately reviewed version instead.
"""
import argparse
import asyncio
import hashlib
import json

from sqlalchemy import func, insert, select, text

from app.db.session import SessionLocal
from app.models.specialist import SpecialistRelease, SpecialistOccupation, SpecialistConcept, SpecialistRelation
from app.services.esco_snapshot import load_esco_snapshot, validate_esco_snapshot


def release_checksum(payload):
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


async def import_catalogue(session, payload):
    """Caller owns the transaction. No intermediate commit or partial release."""
    version = payload['version']
    checksum = release_checksum(payload)
    # Serialize importers for this catalogue without locking unrelated application writes.
    if session.bind.dialect.name == 'postgresql':
        await session.execute(text("SELECT pg_advisory_xact_lock(hashtext('esco-full-catalogue-import'))"))
    existing = (await session.execute(select(SpecialistRelease.__table__).where(SpecialistRelease.version == version))).mappings().one_or_none()
    tables = [(SpecialistOccupation, 'occupations'), (SpecialistConcept, 'skills'), (SpecialistRelation, 'relations')]
    counts = {key: len(payload[key]) for _, key in tables}
    if existing:
        if existing['checksum'] != checksum:
            raise ValueError('This ESCO version has different content. Do not overwrite a published release.')
        for model, key in tables:
            actual = (await session.execute(select(func.count()).select_from(model).where(model.version == version))).scalar_one()
            if actual != counts[key]:
                raise ValueError('The existing ESCO release is incomplete. Restore a verified database backup before retrying.')
        return False
    await session.execute(insert(SpecialistRelease), [dict(version=version, checksum=checksum,
        occupation_count=counts['occupations'], skill_count=counts['skills'], relation_count=counts['relations'],
        source_metadata=payload['metadata'])])
    for model, key in tables:
        for start in range(0, len(payload[key]), 1000):
            rows = []
            for item in payload[key][start:start + 1000]:
                columns = {column.name for column in model.__table__.columns}
                row = {key: value for key, value in item.items() if key in columns}
                row['version'] = version
                if model is not SpecialistRelation:
                    row['search_text'] = ' '.join([item['label'], *item['aliases']]).lower()
                rows.append(row)
            await session.execute(insert(model), rows)
    return True


async def seed(payload):
    validate_esco_snapshot(payload)
    async with SessionLocal() as session:
        async with session.begin():
            return await import_catalogue(session, payload)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validate-only', action='store_true')
    args = parser.parse_args()
    payload = load_esco_snapshot()
    changed = False if args.validate_only else asyncio.run(seed(payload))
    action = 'Validated' if args.validate_only else ('Imported' if changed else 'Already imported')
    print(f"{action} ESCO {payload['version']}: {len(payload['occupations'])} occupations, {len(payload['skills'])} concepts, {len(payload['relations'])} relationships")

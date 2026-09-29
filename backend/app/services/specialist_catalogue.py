"""Pinned catalogue import validation. Never infers personal task-to-skill links."""
import json
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import func, select
from app.models.specialist import SpecialistRelease, SpecialistOccupation, SpecialistConcept, SpecialistRelation

VERSION = '1.2.0'
OCCUPATION_URI = 'http://data.europa.eu/esco/occupation/b31e404e-9af6-457d-a58a-208f612eeba3'
SNAPSHOT = Path(__file__).resolve().parents[1] / 'data/esco/mechanical-technician-v1.2.0.json'


def load_pilot(path: Path = SNAPSHOT) -> dict:
    payload = json.loads(path.read_text(encoding='utf-8'))
    if (payload.get('source'), payload.get('version'), payload.get('isco_code'), payload.get('occupation_uri')) != ('ESCO', VERSION, '3115', OCCUPATION_URI):
        raise ValueError('Unexpected ESCO pilot identity or version.')
    skills = payload.get('skills', [])
    if not skills or len({skill['uri'] for skill in skills}) != len(skills):
        raise ValueError('Expected unique, nonempty specialist concepts.')
    for skill in skills:
        if not skill['uri'].startswith('http://data.europa.eu/esco/skill/') or not skill['label'] or not skill['description']:
            raise ValueError('Each concept needs a source URI, label and description.')
        if skill['relation'] not in ('essential', 'optional') or skill['skill_type'] not in ('skill', 'knowledge'):
            raise ValueError('Unexpected ESCO relation or concept type.')
        if not isinstance(skill['aliases'], list) or not all(isinstance(alias, str) for alias in skill['aliases']):
            raise ValueError('Expected English alternative labels.')
        if 'selectedVersion=v1.2.0' not in skill['provenance']['url']:
            raise ValueError('Unpinned ESCO source.')
    return payload

# Full catalogue queries use the database; the immutable bundle is only for import.

MAPPING_NOTE = ('ESCO occupation links are reference suggestions, not validated Malaysian task mappings. '
                'A shared ISCO group does not mean two occupations are identical. '
                'Review each skill against your actual work; this does not assess proficiency.')


async def require_release(db):
    release = (await db.execute(select(SpecialistRelease.__table__).where(SpecialistRelease.version == VERSION))).mappings().one_or_none()
    if release is None:
        raise HTTPException(status_code=503, detail='The full specialist catalogue is not available yet. Please try again later.')
    return release


def skill_record(row):
    return {key: row[key] for key in ('uri', 'label', 'description', 'skill_type', 'aliases')} | {
        'relation': row.get('relation'), 'source': 'ESCO', 'version': VERSION,
    }


async def catalogue_for_occupation(db, code=None, uri=None):
    release = await require_release(db)
    table = SpecialistOccupation.__table__
    if uri:
        chosen = (await db.execute(select(table).where(table.c.version == VERSION, table.c.uri == uri))).mappings().one_or_none()
        if chosen is None or (code and chosen['isco_code'] != code):
            raise HTTPException(status_code=422, detail='Choose an ESCO occupation from the requested reference group.')
        code = chosen['isco_code']
    else:
        chosen = None
    rows = (await db.execute(select(table).where(table.c.version == VERSION, table.c.isco_code == code).order_by(table.c.label, table.c.uri))).mappings().all()
    if chosen is None and len(rows) == 1:
        chosen = rows[0]
    skills = []
    if chosen:
        concept, relation = SpecialistConcept.__table__, SpecialistRelation.__table__
        matches = await db.execute(select(concept, relation.c.relation).join(relation,
            (concept.c.version == relation.c.version) & (concept.c.uri == relation.c.skill_uri)
        ).where(relation.c.version == VERSION, relation.c.occupation_uri == chosen['uri'])
            .order_by(relation.c.relation, concept.c.label, concept.c.uri))
        unique = {}
        for row in matches.mappings().all():
            if row['uri'] not in unique:
                unique[row['uri']] = skill_record(row) | {'source_relations': []}
            unique[row['uri']]['source_relations'].append(row['relation'])
        skills = list(unique.values())
    metadata = release['source_metadata']
    return dict(source='ESCO', version=VERSION, isco_code=code,
        occupations=[{key: row[key] for key in ('uri', 'label', 'isco_code')} for row in rows],
        occupation_uri=chosen['uri'] if chosen else '', occupation_label=chosen['label'] if chosen else '',
        skills=skills, mapping_note=MAPPING_NOTE,
        license=metadata.get('license', ''), attribution=metadata.get('attribution', ''),
        provenance=metadata.get('provenance', {}), license_url=metadata.get('license_url', ''),
        retrieved_at=metadata.get('retrieved_at', ''),
        catalogue_counts=dict(occupations=release['occupation_count'], skills=release['skill_count'], relations=release['relation_count']))


async def search_catalogue(db, *, concepts=False, query='', code=None, limit=20, offset=0):
    release = await require_release(db)
    table = SpecialistConcept.__table__ if concepts else SpecialistOccupation.__table__
    conditions = [table.c.version == VERSION]
    # Treat user text literally. Wildcards cannot turn a small query into a browse-all query.
    for word in query.lower().split():
        conditions.append(table.c.search_text.contains(word, autoescape=True))
    if code and not concepts:
        conditions.append(table.c.isco_code == code)
    total = (await db.execute(select(func.count()).select_from(table).where(*conditions))).scalar_one()
    rows = (await db.execute(select(table).where(*conditions).order_by(table.c.label, table.c.uri).limit(limit).offset(offset))).mappings().all()
    items = [skill_record(row) if concepts else {key: row[key] for key in ('uri', 'label', 'isco_code')} for row in rows]
    return dict(source='ESCO', version=VERSION, items=items, total=total, limit=limit, offset=offset,
        **{key: release['source_metadata'].get(key, '') for key in ('attribution', 'license', 'license_url')})

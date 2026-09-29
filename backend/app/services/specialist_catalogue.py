"""Pinned catalogue import validation. Never infers personal task-to-skill links."""
import json
import re
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import Text, and_, case, cast, func, literal, or_, select
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


def _concept_search(table, query):
    """Source text retrieval, not a task-to-skill mapping or proficiency assessment.

    PostgreSQL English stemming handles reports/report and complaints/complaint.
    Excel expands only to spreadsheet and AI to artificial intelligence. These
    narrow discovery aids avoid verb excel and T'ai chi, and are not new ESCO links.
    Short technical names retain whole-word matches instead of substring matches.
    """
    words = list(dict.fromkeys(re.findall(r"[^\W_]+(?:[+#]+)?", query.lower())))
    source_text = table.c.search_text + ' ' + table.c.description
    english = func.to_tsvector('english', source_text)
    simple = func.to_tsvector('simple', source_text)
    label_vector = func.to_tsvector('english', table.c.label)
    alias_vector = func.to_tsvector('english', cast(table.c.aliases, Text))
    matches, meaningful, label_matches, alias_matches = [], [], [], []
    for word in words:
        dictionary = 'simple' if word in {'excel', 'r', 'c', 'c++', 'c#', 'ai'} else 'english'
        term = func.plainto_tsquery(dictionary, word)
        active = func.numnode(term) > 0
        match = (simple if dictionary == 'simple' else english).op('@@')(term)
        label_match = func.to_tsvector(dictionary, table.c.label).op('@@')(term)
        alias_match = func.to_tsvector(dictionary, cast(table.c.aliases, Text)).op('@@')(term)
        if word in {'c', 'c++', 'c#'}:
            # PostgreSQL tokenization discards + and #, so preserve these names.
            pattern = r'(?<![[:alnum:]_])' + re.escape(word) + r'(?![[:alnum:]_+#])'
            match = source_text.op('~*')(pattern)
            label_match = table.c.label.op('~*')(pattern)
            alias_match = cast(table.c.aliases, Text).op('~*')(pattern)
        if word in {'excel', 'ai'}:
            # These ambiguous short words have explicit software/technology intent.
            # Do not retrieve performers who 'excel' or the token in T'ai chi.
            expansion = func.plainto_tsquery('english', 'spreadsheet' if word == 'excel' else 'artificial intelligence')
            match = english.op('@@')(expansion)
            label_match = label_vector.op('@@')(expansion)
            alias_match = alias_vector.op('@@')(expansion)
        matches.append(and_(active, match))
        meaningful.append(active)
        label_matches.append(and_(active, label_match))
        alias_matches.append(and_(active, alias_match))
    score = sum((case((match, 1), else_=0) for match in matches), literal(0))
    required = sum((case((active, 1), else_=0) for active in meaningful), literal(0))
    all_terms = and_(required > 0, score == required)
    # Partial results require two meaningful words for a longer task description.
    partial = and_(required > 0, score >= func.least(2, required))
    normalized = ' '.join(query.lower().split())
    exact_label = func.lower(table.c.label) == normalized
    exact_alias = func.lower(cast(table.c.aliases, Text)).contains(json.dumps(normalized), autoescape=True)
    exact = or_(exact_label, exact_alias)
    rank = case((exact_label, 2), (exact_alias, 1), else_=0)
    # Generic task verbs should not outrank the subject of a user's task. This
    # affects ordering only, never creates a skill link or removes exact matches.
    generic_verbs = {'prepare', 'preparing', 'use', 'using', 'create', 'creating', 'make', 'making', 'do', 'doing', 'perform', 'performing'}
    # A task's leading clause is usually its main activity. Later context still
    # contributes, but must not drown out the task with incidental description words.
    leading_clause = re.split(r'\b(?:for|and|then|while|so that)\b', query.lower(), maxsplit=1)[0]
    leading_words = set(re.findall(r"[^\W_]+(?:[+#]+)?", leading_clause))
    weights = [(1 if word in generic_verbs else 3) * (2 if word in leading_words else 1) for word in words]
    relevance = sum((case((match, weight), else_=0) for match, weight in zip(matches, weights)), literal(0))
    label_score = sum((case((match, weight), else_=0) for match, weight in zip(label_matches, weights)), literal(0))
    alias_score = sum((case((match, 1), else_=0) for match in alias_matches), literal(0))
    # Prefer a focused concept name over a long name with incidental matching words.
    focused_label_score = label_score / (1 + func.length(label_vector) * 0.3)
    columns = [case((exact, 'exact'), (all_terms, 'terms'), else_='related').label('match_type')]
    columns += [match.label(f'matched_{index}') for index, match in enumerate(matches)]
    return or_(exact, partial), [rank.desc(), focused_label_score.desc(), alias_score.desc(), all_terms.desc(), relevance.desc()], columns, words


async def search_catalogue(db, *, concepts=False, query='', code=None, limit=20, offset=0):
    release = await require_release(db)
    table = SpecialistConcept.__table__ if concepts else SpecialistOccupation.__table__
    conditions = [table.c.version == VERSION]
    order, columns, words = [], [], []
    # SQLite is used for catalogue import contract tests. Deployed catalogue search
    # runs on PostgreSQL, whose dictionaries provide the source-text stemming.
    postgres = db.bind.dialect.name == 'postgresql'
    if query.strip() and concepts and postgres:
        match, order, columns, words = _concept_search(table, query)
        conditions.append(match)
    else:
        for word in query.lower().split():
            conditions.append(table.c.search_text.contains(word, autoescape=True))
    if code and not concepts:
        conditions.append(table.c.isco_code == code)
    total = (await db.execute(select(func.count()).select_from(table).where(*conditions))).scalar_one()
    rows = (await db.execute(select(table, *columns).where(*conditions)
        .order_by(*order, table.c.label, table.c.uri).limit(limit).offset(offset))).mappings().all()
    items = []
    for row in rows:
        item = skill_record(row) if concepts else {key: row[key] for key in ('uri', 'label', 'isco_code')}
        if columns:
            item.update(match_type=row['match_type'], matched_terms=[word for index, word in enumerate(words) if row[f'matched_{index}']])
        items.append(item)
    mode = 'browse' if not query.strip() else ('none' if not total else 'matches')
    if items and items[0].get('match_type') == 'related':
        mode = 'related'
    return dict(source='ESCO', version=VERSION, items=items, total=total, limit=limit, offset=offset, search_mode=mode,
        **{key: release['source_metadata'].get(key, '') for key in ('attribution', 'license', 'license_url')})

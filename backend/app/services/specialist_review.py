"""Validate personal specialist-skill choices without treating them as source facts."""
from datetime import datetime
import json
import re

SPECIALIST_KEY = 'aiwrevolusi.specialistSkills.v1'
FIELDS = {'taskId', 'taskWording', 'occupationCode', 'skillUri', 'skillLabel', 'sourceVersion', 'decision', 'wantsLearning', 'updatedAt'}


def _text(value: object, maximum: int) -> bool:
    return isinstance(value, str) and bool(value.strip()) and len(value) <= maximum


def validate_specialist_review(value: object) -> dict:
    error = 'Saved specialist skills are invalid. Reload your saved account before changing them.'
    if not isinstance(value, dict) or set(value) != {'version', 'entries', 'focusKey'} or type(value['version']) is not int or value['version'] != 1:
        raise ValueError(error)
    entries = value['entries']
    if not isinstance(entries, list) or len(entries) > 200:
        raise ValueError(error)
    keys = set()
    wanted = set()
    for entry in entries:
        if not isinstance(entry, dict) or not FIELDS.issubset(entry) or not set(entry).issubset(FIELDS | {'sourceOccupationUri'}):
            raise ValueError(error)
        if not _text(entry['taskId'], 200) or not _text(entry['taskWording'], 5000) or not _text(entry['skillLabel'], 300) or not _text(entry['sourceVersion'], 40):
            raise ValueError(error)
        if entry['occupationCode'] is not None and not _text(entry['occupationCode'], 40):
            raise ValueError(error)
        if not isinstance(entry['skillUri'], str) or not re.fullmatch(r'http://data\.europa\.eu/esco/skill/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', entry['skillUri']):
            raise ValueError(error)
        source_role = entry.get('sourceOccupationUri')
        if source_role is not None and (not isinstance(source_role, str) or not re.fullmatch(r'http://data\.europa\.eu/esco/occupation/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', source_role)):
            raise ValueError(error)
        if entry['decision'] is not None and entry['decision'] not in ('use', 'no', 'unsure'):
            raise ValueError(error)
        if type(entry['wantsLearning']) is not bool or not _text(entry['updatedAt'], 40):
            raise ValueError(error)
        try:
            datetime.fromisoformat(entry['updatedAt'].replace('Z', '+00:00'))
        except ValueError:
            raise ValueError(error) from None
        key = json.dumps([entry['taskId'], entry['skillUri']], separators=(',', ':'), ensure_ascii=False)
        if key in keys:
            raise ValueError(error)
        keys.add(key)
        if entry['wantsLearning']:
            wanted.add(key)
    if value['focusKey'] is not None and (not _text(value['focusKey'], 400) or value['focusKey'] not in wanted):
        raise ValueError(error)
    return value

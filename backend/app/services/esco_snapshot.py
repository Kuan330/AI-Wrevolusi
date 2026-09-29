"""Read and validate the complete pinned ESCO release, without network access."""
import gzip
import hashlib
import json
from pathlib import Path
import re

VERSION = '1.2.0'
SNAPSHOT = Path(__file__).resolve().parents[1] / 'data/esco/catalogue-v1.2.0.json.gz'
EXPECTED_COUNTS = dict(skills=13939, occupations=3039, relations=129004)
# Independently pinned after converting the checksum-verified official archive.
# Unlike metadata's archive hash, this checks every normalized source field.
# Updating either pin requires reviewing a fresh official release/conversion.
EXPECTED_CORE_SHA256 = 'a00bb54c01b45f2790c74a04665ac920f2c61d5eb311b33da7bfd5a489fde488'


def core_sha256(payload: dict) -> str:
    core = {key: payload[key] for key in ('source', 'version', 'skills', 'occupations', 'relations')}
    encoded = json.dumps(core, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def validate_esco_snapshot(payload: dict) -> None:
    if payload.get('source') != 'ESCO' or payload.get('version') != VERSION:
        raise ValueError('Unexpected ESCO source or release.')
    for name, count in EXPECTED_COUNTS.items():
        if len(payload.get(name, [])) != count or payload.get('metadata', {}).get('counts', {}).get(name) != count:
            raise ValueError(f'Incomplete ESCO release: {name}.')
    skills, occupations = {}, {}
    for name, destination, kind in [('skills', skills, 'skill'), ('occupations', occupations, 'occupation')]:
        for row in payload[name]:
            uri = row['uri']
            if not re.fullmatch(r'http://data\.europa\.eu/esco/' + kind + r'/[0-9a-f-]{36}', uri) or uri in destination:
                raise ValueError(f'Invalid or duplicate ESCO {kind} URI.')
            if not row['label'] or not row['description'] or not isinstance(row['aliases'], list) or not all(isinstance(alias, str) for alias in row['aliases']):
                raise ValueError('Missing English concept text.')
            if kind == 'skill' and row['skill_type'] not in ('skill', 'knowledge', 'unspecified'):
                raise ValueError('Unknown ESCO skill type.')
            if kind == 'occupation' and not re.fullmatch(r'\d{4}', row['isco_code']):
                raise ValueError('Invalid ISCO occupation group.')
            destination[uri] = row
    seen = set()
    for row in payload['relations']:
        key = (row['occupation_uri'], row['skill_uri'], row['relation'])
        if key in seen or key[0] not in occupations or key[1] not in skills or key[2] not in ('essential', 'optional'):
            raise ValueError('Duplicate, dangling or unknown ESCO relationship.')
        seen.add(key)
    metadata = payload['metadata']
    if not metadata.get('license_url') or not metadata.get('attribution') or not metadata.get('retrieved_at'):
        raise ValueError('Missing source attribution.')
    if metadata['provenance']['sha256'] != 'a508787a7ffc025876424e19fc71d6e1e7b2ee4f7ccae205e27b63b2adebace7':
        raise ValueError('Unreviewed ESCO source archive.')
    if core_sha256(payload) != EXPECTED_CORE_SHA256:
        raise ValueError('ESCO snapshot content differs from the reviewed official release. Review the source and conversion before updating the content checksum.')


def load_esco_snapshot(path: Path = SNAPSHOT) -> dict:
    with gzip.open(path, 'rt', encoding='utf-8') as source:
        payload = json.load(source)
    validate_esco_snapshot(payload)
    return payload

"""Refresh the pinned public ESCO pilot; review the diff before database import.

Run from the repository root: python backend/scripts/fetch_esco_pilot.py
No credentials, user data or database writes are involved.
"""
from datetime import datetime, timezone
import concurrent.futures
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

VERSION = 'v1.2.0'
URI = 'http://data.europa.eu/esco/occupation/b31e404e-9af6-457d-a58a-208f612eeba3'
OUTPUT = Path(__file__).resolve().parents[1] / 'app/data/esco/mechanical-technician-v1.2.0.json'


def fetch(kind, uri):
    url = 'https://ec.europa.eu/esco/api/resource/' + kind + '?' + urlencode({
        'uri': uri, 'language': 'en', 'selectedVersion': VERSION,
    })
    with urlopen(url, timeout=45) as response:
        raw = response.read()
    return json.loads(raw), {'url': url, 'sha256': hashlib.sha256(raw).hexdigest()}


def main():
    occupation, provenance = fetch('occupation', URI)
    assert occupation['uri'] == URI and occupation['code'] == '3115.1'
    assert occupation['_links']['broaderIscoGroup'][0]['code'] == '3115'
    entries = [(relation, link) for relation, name in [('essential', 'hasEssentialSkill'), ('optional', 'hasOptionalSkill')]
               for link in occupation['_links'].get(name, [])]

    def skill(entry):
        relation, link = entry
        value, evidence = fetch('skill', link['uri'])
        assert value['uri'] == link['uri']
        return dict(uri=value['uri'], label=value['preferredLabel']['en'],
                    description=value['description']['en']['literal'], relation=relation,
                    skill_type=link['skillType'].rsplit('/', 1)[-1],
                    aliases=value.get('alternativeLabel', {}).get('en', []), provenance=evidence)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        skills = sorted(pool.map(skill, entries), key=lambda row: (row['relation'], row['label']))
    payload = dict(source='ESCO', version='1.2.0', occupation_uri=URI,
                   occupation_label=occupation['preferredLabel']['en'], isco_code='3115',
                   occupation_code=occupation['code'], skills=skills,
                   mapping_note='ESCO ISCO group 3115 narrows the candidate occupation. It does not establish a validated Malaysian task-to-skill crosswalk. These occupation-level suggestions are not proof of your skills; review their relevance to your work.',
                   attribution='Source: European Commission, ESCO v1.2.0. English occupation and skill subset; fields selected and reformatted by AI-Wrevolusi. No endorsement implied.',
                   license='European Commission reuse policy; attribution required',
                   license_url='https://commission.europa.eu/legal-notice_en',
                   provenance=provenance, retrieved_at=datetime.now(timezone.utc).isoformat())
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(skills)} official skill/knowledge concepts to {OUTPUT}')


if __name__ == '__main__':
    main()

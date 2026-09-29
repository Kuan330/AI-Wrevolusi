"""Download and convert the complete official English ESCO 1.2.0 CSV release.

python -m scripts.fetch_esco_catalogue --archive /tmp/esco-v1.2.0-en-csv.zip
Omit --archive to download it. No database writes. Standard library only.
The archive is streamed and stays outside the repository; only normalized gzip
JSON is bundled. Source content and missing source types are preserved.
"""
import argparse
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
from pathlib import Path
import shutil
import tempfile
from urllib.request import urlopen
import zipfile

VERSION = '1.2.0'
SOURCE_URL = 'https://ec.europa.eu/esco/download/ESCO%20dataset%20-%20v1.2.0%20-%20classification%20-%20en%20-%20csv.zip'
# Pin the full official archive, not a search/API subset or a changing latest URL.
ARCHIVE_SHA256 = 'a508787a7ffc025876424e19fc71d6e1e7b2ee4f7ccae205e27b63b2adebace7'
OUTPUT = Path(__file__).resolve().parents[1] / 'app/data/esco/catalogue-v1.2.0.json.gz'


def records(archive, name):
    with archive.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))


def aliases(value):
    return list(dict.fromkeys(label.strip() for label in value.splitlines() if label.strip()))


def convert(path, output=OUTPUT):
    with path.open('rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    if checksum != ARCHIVE_SHA256:
        raise ValueError('Archive differs from the reviewed official ESCO v1.2.0 release. Review its source before updating the pinned checksum.')
    with zipfile.ZipFile(path) as archive:
        skills = [dict(
            uri=row['conceptUri'], label=row['preferredLabel'], description=row['description'],
            skill_type={'skill/competence': 'skill', 'knowledge': 'knowledge', '': 'unspecified'}[row['skillType']],
            aliases=aliases(row['altLabels']),
        ) for row in records(archive, 'skills_en.csv')]
        occupations = [dict(
            uri=row['conceptUri'], label=row['preferredLabel'], description=row['description'],
            isco_code=row['iscoGroup'], aliases=aliases(row['altLabels']),
        ) for row in records(archive, 'occupations_en.csv')]
        relations = [dict(
            occupation_uri=row['occupationUri'], skill_uri=row['skillUri'], relation=row['relationType'],
        ) for row in records(archive, 'occupationSkillRelations_en.csv')]
    payload = dict(source='ESCO', version=VERSION,
                   skills=sorted(skills, key=lambda row: row['uri']),
                   occupations=sorted(occupations, key=lambda row: row['uri']),
                   relations=sorted(relations, key=lambda row: (row['occupation_uri'], row['skill_uri'], row['relation'])),
                   metadata=dict(
                       provenance=dict(url=SOURCE_URL, sha256=checksum),
                       retrieved_at=datetime.now(timezone.utc).isoformat(),
                       language='en',
                       counts=dict(skills=len(skills), occupations=len(occupations), relations=len(relations)),
                       unspecified_skill_type_count=sum(row['skill_type'] == 'unspecified' for row in skills),
                       attribution='Source: European Commission, ESCO v1.2.0, English classification. Fields selected and reformatted by AI-Wrevolusi; all concepts and occupation-skill links retained. No endorsement implied.',
                       license='European Commission reuse policy; attribution required',
                       license_url='https://commission.europa.eu/legal-notice_en',
                       mapping_note='ESCO occupation-skill relationships describe European occupations. Sharing an ISCO group does not establish a validated Malaysian task-to-skill crosswalk or prove that a person has a skill.',
                   ))
    # Import only after conversion so this script also works as a module from backend.
    from app.services.esco_snapshot import validate_esco_snapshot
    validate_esco_snapshot(payload)
    output.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    output.write_bytes(gzip.compress(content, mtime=0))
    print(f"Wrote {output}: {payload['metadata']['counts']}")
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    if args.archive:
        convert(args.archive, args.output)
        return
    with tempfile.TemporaryDirectory(prefix='esco-reference-') as temporary:
        path = Path(temporary) / 'esco-v1.2.0-en-csv.zip'
        with urlopen(SOURCE_URL, timeout=120) as response, path.open('wb') as target:
            shutil.copyfileobj(response, target, length=1024 * 1024)
        convert(path, args.output)


if __name__ == '__main__':
    main()

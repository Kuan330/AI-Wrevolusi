"""Read-only engineering relevance evaluation against a local seeded test database.

Set SPECIALIST_SEARCH_TEST_DATABASE_URL, then run this file with --output PATH.
The corpus includes independent source-definition judgements, not exhaustive labels.
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.services.specialist_catalogue import search_catalogue

CORPUS = Path(__file__).with_name('task_cases.json')


def metrics(results):
    single = [r for r in results if r['kind'] == 'single']
    compound = [r for r in results if r['kind'] == 'compound']
    negative = [r for r in results if r['kind'] == 'negative']
    return {
        'cases': len(results),
        'single_cases': len(single),
        'single_expected_hit_at_5': sum(r['expected_hit_at_5'] for r in single) / len(single) if single else None,
        'compound_cases': len(compound),
        'compound_expected_coverage_at_10': sum(r['expected_coverage_at_10'] for r in compound) / len(compound) if compound else None,
        'negative_cases': len(negative),
        'negative_output_violation_rate': sum(r['negative_output_violation'] for r in negative) / len(negative) if negative else None,
        'mean_seconds': sum(r['seconds'] for r in results) / len(results) if results else None,
        'errors': sum('error' in r for r in results),
    }


async def run(args):
    corpus = json.loads(CORPUS.read_text())
    url = os.environ['SPECIALIST_SEARCH_TEST_DATABASE_URL']
    parsed = make_url(url)
    if parsed.host not in {'localhost', '127.0.0.1'} or 'test' not in (parsed.database or '').lower():
        raise ValueError('Only an explicitly named local test database is accepted.')
    engine = create_async_engine(url)
    results = []
    try:
        async with async_sessionmaker(engine)() as db:
            for case in corpus['cases']:
                if args.split != 'all' and case['split'] != args.split:
                    continue
                query = case['baseline_query'] if args.query_mode == 'baseline' else case['task']
                started = time.monotonic()
                response = await search_catalogue(db, concepts=True, query=query, limit=10)
                if response['version'] != corpus['esco_version']:
                    raise ValueError('Catalogue version does not match frozen annotations.')
                items = response['items']
                top5 = {item['uri'] for item in items[:5]}
                top10 = {item['uri'] for item in items}
                expected = {item['uri'] for item in case['expected']}
                forbidden = {item['uri'] for item in case['forbidden']}
                result = {
                    'id': case['id'], 'split': case['split'], 'domain': case['domain'], 'kind': case['kind'],
                    'query': query, 'query_length': len(query), 'full_task_length': len(case['task']),
                    'seconds': round(time.monotonic() - started, 4),
                    'expected': case['expected'], 'forbidden': case['forbidden'],
                    'total': response['total'], 'search_mode': response['search_mode'],
                    'items': [{'uri': item['uri'], 'label': item['label'], 'match_type': item.get('match_type'), 'matched_terms': item.get('matched_terms')} for item in items],
                    'expected_hit_at_5': bool(expected & top5),
                    'expected_coverage_at_10': len(expected & top10) / len(expected) if expected else None,
                    'negative_output_violation': bool((case['expect_empty'] and response['total'] > 0) or forbidden & top10),
                }
                results.append(result)
    finally:
        await engine.dispose()
    output = {
        'corpus_sha256': hashlib.sha256(CORPUS.read_bytes()).hexdigest(),
        'esco_version': corpus['esco_version'], 'source_bundle_sha256': corpus['source_bundle_sha256'],
        'baseline_head': corpus['baseline_head'],
        'measured_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
        'matcher_sha256': hashlib.sha256((Path(__file__).resolve().parents[2] / 'app/services/specialist_catalogue.py').read_bytes()).hexdigest(),
        'query_mode': args.query_mode,
        'interpretation': corpus['annotation_policy'], 'metric_definitions': corpus['metrics'],
        'metrics': {split: metrics([r for r in results if split == 'all' or r['split'] == split]) for split in ['all', 'dev', 'heldout']},
        'results': results,
    }
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'output': str(path), 'corpus_sha256': output['corpus_sha256'], 'metrics': output['metrics']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--split', choices=['all', 'dev', 'heldout'], default='all')
    parser.add_argument('--query-mode', choices=['baseline', 'full'], default='baseline')
    parser.add_argument('--output', required=True)
    asyncio.run(run(parser.parse_args()))

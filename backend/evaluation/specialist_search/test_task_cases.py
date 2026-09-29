"""Offline checks that the frozen engineering annotations retain source identity."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS = Path(__file__).with_name('task_cases.json')


def test_frozen_corpus_matches_the_pinned_source():
    corpus = json.loads(CORPUS.read_text())
    bundle = ROOT / 'app/data/esco/catalogue-v1.2.0.json.gz'
    assert hashlib.sha256(bundle.read_bytes()).hexdigest() == corpus['source_bundle_sha256']
    source = json.load(gzip.open(bundle, 'rt'))
    assert source['version'] == corpus['esco_version']
    concepts = {item['uri']: item for item in source['skills']}
    assert len(corpus['cases']) == 30
    assert len({case['id'] for case in corpus['cases']}) == 30
    for case in corpus['cases']:
        assert case['split'] in {'dev', 'heldout'}
        assert case['baseline_query'] == case['task'][:300]
        assert case['baseline_query_truncated'] == (len(case['task']) > 300)
        if case['kind'] != 'negative':
            assert case['expected']
        else:
            assert case['expect_empty'] or case['forbidden']
        for reference in case['expected'] + case['forbidden']:
            assert reference['label'] == concepts[reference['uri']]['label']
            assert reference['source_definition'] == concepts[reference['uri']]['description']
    for split in ['dev', 'heldout']:
        cases = [case for case in corpus['cases'] if case['split'] == split]
        assert len(cases) == 15
        assert {'administration', 'sales', 'nursing', 'technical', 'software', 'teaching'} <= {case['domain'] for case in cases}

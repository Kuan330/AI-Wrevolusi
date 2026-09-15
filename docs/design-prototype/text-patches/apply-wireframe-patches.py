"""Apply generated text repairs to derived wireframes and review boards only.

Idempotent. Run after any normal wireframe/board rebuild. Does not touch current
screen-assets, capture JSON, the original generators, or the native registry.
"""
from pathlib import Path
import copy
import json
import re
import xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
ROOT=OUT.parent
NS='http://www.w3.org/2000/svg'
ET.register_namespace('',NS)
tag=lambda name:'{'+NS+'}'+name
manifest=json.loads((OUT/'manifest.json').read_text())
patches=[p for p in manifest['patches'] if p['mode']=='wireframe']


def apply(root,patch,prefix):
    marker='text-repair-'+patch['target']+'-'+('wrapped-word' if patch.get('family') else 'progress')
    for old in list(root):
        if old.get('data-text-repair')==marker:
            root.remove(old)
    nested=ET.parse(OUT/patch['file']).getroot()
    ids={n.get('id'):prefix+n.get('id') for n in nested.iter() if n.get('id')}
    for n in nested.iter():
        for k,v in list(n.attrib.items()):
            if k=='id':v=ids[v]
            else:v=re.sub(r'url\(#([^)]*)\)',lambda m:'url(#'+ids.get(m[1],m[1])+')',v)
            n.set(k,v)
    nested.set('id',prefix+'root')
    nested.set('data-text-repair',marker)
    nested.set('x',str(patch['x']));nested.set('y',str(patch['y']))
    root.append(nested)


def validate(root):
    ids=[n.get('id') for n in root.iter() if n.get('id')]
    assert len(ids)==len(set(ids)), 'Duplicate SVG ids'
    known=set(ids)
    for n in root.iter():
        for v in n.attrib.values():
            for target in re.findall(r'url\(#([^)]*)\)',v):
                assert target in known, 'Missing SVG reference '+target
    ET.fromstring(ET.tostring(root))


outputs=[]
for patch in patches:
    path=ROOT/'wireframes'/f'{patch["target"]}.svg'
    root=ET.parse(path).getroot()
    apply(root,patch,f'repair-{patch["target"]}-')
    validate(root)
    path.write_text(ET.tostring(root,encoding='unicode',xml_declaration=True)+'\n')
    outputs.append(str(path.relative_to(ROOT)))

board_manifest=json.loads((ROOT/'wireframe-boards'/'manifest.json').read_text())
board_count=0
for board in board_manifest['boards']:
    relevant=[p for p in patches if p['target'] in {s['stem'] for s in board['screens']}]
    if not relevant:continue
    path=ROOT/'wireframe-boards'/board['svg'];root=ET.parse(path).getroot()
    for patch in relevant:
        identifier=f'{board["name"]}-{patch["target"]}-screen'
        screen=next(n for n in root.iter(tag('svg')) if n.get('id')==identifier)
        apply(screen,patch,f'{board["name"]}-repair-{patch["target"]}-')
    validate(root)
    path.write_text(ET.tostring(root,encoding='unicode',xml_declaration=True)+'\n')
    outputs.append(str(path.relative_to(ROOT)));board_count+=1
manifest['applied_wireframe_outputs']=sorted(set(outputs))
manifest['wireframe_application']={'standalone_count':len(patches),'board_count':board_count,'method':'Added opaque matching background plus editable text overlays; original captured nodes preserved underneath.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest['wireframe_application'],indent=2))

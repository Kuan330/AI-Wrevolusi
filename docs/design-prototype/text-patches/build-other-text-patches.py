"""Repair the remaining captured words that wrap at hyphens.

Only writes text-patches/. Follow with apply-wireframe-patches.py to update
derived wireframes and boards. Existing screen-assets and generators stay intact.
"""
from pathlib import Path
import copy
import json
import math
import re
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
tag = lambda name: '{'+NS+'}'+name


def overlaps(a, b):
    return (a[0] < b[0]+b[2] and a[0]+a[2] > b[0]
            and a[1] < b[1]+b[3] and a[1]+a[3] > b[1])


def matching_background(source, crop, defs, group):
    """Repaint only captured background shapes intersecting the patch.

    This retains the same gradients, opacity composition and borders as the
    existing imported screen, instead of painting a noticeable flat rectangle.
    """
    original = ET.parse(source).getroot()
    originals = {n.get('id'): n for n in original.find(tag('defs')) if n.get('id')}
    wanted = set()
    for node in original.iter(tag('g')):
        if not re.fullmatch(r'boxes-\d+', node.get('id','')):
            continue
        rect = node.find(tag('rect'))
        if rect is None:
            continue
        bounds = tuple(float(rect.get(k,0)) for k in ['x','y','width','height'])
        if overlaps(bounds,crop):
            clone=copy.deepcopy(node)
            group.append(clone)
            wanted.update(re.findall(r'url\(#([^)]*)\)', ET.tostring(clone,encoding='unicode')))
    copied=set()
    while wanted-copied:
        key=sorted(wanted-copied)[0]
        if key not in originals:
            raise ValueError(f'Missing background definition {key} in {source}')
        clone=copy.deepcopy(originals[key]); defs.append(clone); copied.add(key)
        wanted.update(re.findall(r'url\(#([^)]*)\)',ET.tostring(clone,encoding='unicode')))


def write_patch(stem, mode, crop, fragments, evidence):
    x,y,w,h=crop
    name=f'{stem}-{mode}-wrapped-word-text.svg'
    source=ROOT/('screen-assets/figma' if mode=='current' else 'wireframes')/f'{stem}.svg'
    root=ET.Element(tag('svg'),width=str(w),height=str(h),viewBox=f'0 0 {w} {h}')
    ET.SubElement(root,tag('title')).text=f'{stem} — wrapped word text repair — {mode}'
    ET.SubElement(root,tag('desc')).text=f'Place at x {x}, y {y} in the matching frame. Native text remains editable. {evidence}'
    defs=ET.SubElement(root,tag('defs'))
    clip=ET.SubElement(defs,tag('clipPath'),id='patch-viewport')
    ET.SubElement(clip,tag('rect'),x='0',y='0',width=str(w),height=str(h))
    ET.SubElement(root,tag('rect'),x='0',y='0',width=str(w),height=str(h),fill='#ffffff')
    mask=ET.SubElement(root,tag('g'),{'clip-path':'url(#patch-viewport)'})
    layer=ET.SubElement(mask,tag('g'),transform=f'translate({-x} {-y})')
    matching_background(source,crop,defs,layer)
    for f in fragments:
        attrs={'x':f'{f["x"]:.3f}','y':f'{f["baseline"]:.3f}',
               'font-family':'Inter, Arial, sans-serif','font-size':str(f['size']),
               'font-weight':str(f['weight']),'fill':f['fill'] if mode=='current' else '#333333'}
        if f.get('anchor'): attrs['text-anchor']=f['anchor']
        ET.SubElement(layer,tag('text'),attrs).text=f['text']
    ET.fromstring(ET.tostring(root))
    (OUT/name).write_text(ET.tostring(root,encoding='unicode',xml_declaration=True)+'\n')
    return {'file':name,'target':stem,'mode':mode,'x':x,'y':y,'width':w,'height':h,
            'family':'wrapped-word','source_text':evidence,'fragments':[f['text'] for f in fragments],
            'baselines_in_original_frame':[round(f['baseline'],3) for f in fragments]}


def fragment(text,x,y,source,anchor=None):
    f={'text':text,'x':x,'baseline':y,'size':source['fontSize'],'weight':source['fontWeight'],'fill':source['fill']}
    if anchor: f['anchor']=anchor
    return f


specs=[]
for stem in ['exposure-mobile','help-accepted-mobile','help-declined-mobile','help-status-mobile','help-waiting-mobile','skills-desktop','skills-signed-desktop']:
    data=json.loads((ROOT/'layout-captures'/f'{stem}.json').read_text())
    if stem=='exposure-mobile':
        t=next(t for t in data['texts'] if t['text'].startswith('Start with a task'))
        crop=(40,3047,313,40)
        baseline=t['y']+12.12
        fragments=[fragment('Start with a task you do often or find time-',41,baseline,t),
                   fragment('consuming.',41,baseline+20,t)]
    elif stem.startswith('help-'):
        index=next(i for i,t in enumerate(data['texts']) if t['text'].startswith('“Prototype example: school pickup” on'))
        t=data['texts'][index]; following=data['texts'][index+1]
        crop=(35,math.floor(t['y'])-1,331,44)
        baseline=t['y']+12.88
        fragments=[fragment('“Prototype example: school pickup” on 2026-09-',36,baseline,t),
                   fragment('16,',36,following['y']+12.88,t),
                   fragment(following['text'],following['x'],following['y']+12.88,following)]
    else:
        t=next(t for t in data['texts'] if t['text']=='Motivation and self-awareness')
        crop=(546,350,215,49)
        centre=t['x']+t['width']/2
        baseline=t['y']+11.312
        fragments=[fragment('Motivation and self-',centre,baseline,t,'middle'),
                   fragment('awareness',centre,baseline+14.5625,t,'middle')]
    assert t['height'] > float(t['lineHeight'].replace('px',''))*1.45
    specs.append((stem,crop,fragments,t['text']))

manifest=json.loads((OUT/'manifest.json').read_text())
manifest['patches']=[p for p in manifest['patches'] if p.get('family')!='wrapped-word']
for stem,crop,fragments,evidence in specs:
    for mode in ['current','wireframe']:
        manifest['patches'].append(write_patch(stem,mode,crop,fragments,evidence))
manifest['purpose']='Repair all 12 tall text-range fragments identified in the current capture set.'
manifest['repaired_other_capture_fragments']=[{'target':s,'source_text':e,'fragments':[f['text'] for f in fs]} for s,_,fs,e in specs]
manifest['other_capture_fragments_to_review']=[]
manifest['source_checks']={
    'frontend/src/pages/AIExposure/components/TaskGuide.tsx:315':'Exact time-consuming sentence verified in current source.',
    'frontend/src/pages/Plan/planModel.ts:106':'Prepared help message template verified in current source.',
    'frontend/src/data/pilotWefSkills.ts:13':'Motivation and self-awareness label verified in current source.',
    'discovery':'codebase-memory tools are unavailable; used narrowly targeted current-source reads.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'README.md').write_text('''# Editable text repairs

There are **24 small SVG overlays**: current and wireframe versions for all **12 affected captures**. They repair text that wrapped inside a hyphenated word but was captured as one tall rectangle.

`manifest.json` records every filename, target screen, local x/y position, size and text baseline. The current overlays are ready for Figma placement. The wireframe overlays are already applied to the standalone wireframe files and three affected boards. Current screen-assets and the native Figma registry remain unchanged.

## Reproduce

From the repository root, run these commands after any normal wireframe or board rebuild:

```sh
python3 docs/design-prototype/text-patches/build-plan-text-patches.py
python3 docs/design-prototype/text-patches/build-other-text-patches.py
python3 docs/design-prototype/text-patches/apply-wireframe-patches.py
```

The final command updates only the derived `wireframes/` and `wireframe-boards/` SVG outputs. It replaces its own marked overlays on repeat runs. It preserves the original captured nodes underneath and leaves the original capture/build generators intact.

## Repairs

| Captures | Correct line fragments |
| --- | --- |
| plan-mobile, plan-completed-mobile, plan-conflict-mobile, plan-resolved-mobile, help-draft-mobile | `2026-10-` then `12`, alongside the unchanged completion text |
| exposure-mobile | `Start with a task you do often or find time-` then `consuming.` |
| help-accepted-mobile, help-declined-mobile, help-status-mobile, help-waiting-mobile | Message line ends `2026-09-`; next line starts `16,` before the unchanged time text |
| skills-desktop, skills-signed-desktop | Centred `Motivation and self-` then `awareness` |

The help and skill breaks are visible in the captured screenshots. The plan and exposure full-page screenshots reflowed wider; their two-line fragments follow the narrower JSON geometry already imported into Figma. The exact source wording is preserved.

Each overlay paints an opaque background before restoring editable text with explicit baselines. The seven additional repairs copy only the matching captured background shapes and required gradient/clip definitions. This preserves the existing gradients and panel surfaces and avoids flat colour seams.

## Cause and durable fix

`read-rendered-layout.js` splits each DOM text node on whitespace and asks `Range.getBoundingClientRect()` for each word. Browsers can wrap inside a word at a hyphen. The rectangle then covers multiple lines, but the exporter draws all of the text at one baseline.

A durable capture fix should measure character ranges and group characters by rendered line. Using `getClientRects()` alone is not enough unless source characters are mapped to each fragment. These patches leave the capture generator unchanged.

## Verification

- All 24 patch SVGs parse as XML.
- All 12 patched standalone wireframes and three boards have unique IDs and valid internal references.
- Applying the patches twice produces identical outputs.
- The completion counts and full date values are preserved.
- File hashes confirm that the 24 affected current screen originals, native registry and three original capture/build scripts did not change.
- Source text was checked in TaskGuide.tsx, planModel.ts and pilotWefSkills.ts. Codebase-memory tools were unavailable, so the source lookup was narrow and direct.
- Figma placement and visual readback of the current overlays are the final UI check.
''')
print(f'Created {len(specs)*2} additional patches; {len(manifest["patches"])} total')

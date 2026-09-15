"""Create narrow overlays without changing any captured screens or Figma registry."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
from html import escape

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent
NAMES = ['plan-mobile', 'plan-completed-mobile', 'plan-conflict-mobile', 'plan-resolved-mobile', 'help-draft-mobile']
X, Y, W, H = 40, 439, 295, 37
manifest = {
    'purpose': 'Repair a wrapped date that the capture exporter collapsed onto the preceding progress text.',
    'method': 'Cover the affected line with an opaque matching background, then redraw text with explicit baselines.',
    'source_geometry': 'The JSON has 293 px of inner content width. The full-page screenshot reflows wider. These overlays preserve the JSON frame geometry.',
    'date_fragment_note': 'The 33 px-high date range spans two 18 px lines. Its right edge and the preceding text imply 2026-10- on line one and 12 on line two.',
    'desktop': 'No desktop patch needed: all inspected desktop date ranges have normal 15 px height and a correct x position.',
    'patches': [],
}

for name in NAMES:
    data = json.loads((ROOT / 'layout-captures' / f'{name}.json').read_text())
    date_index = next(i for i, t in enumerate(data['texts']) if t['text'] == '2026-10-12' and t['height'] > 20)
    date = data['texts'][date_index]
    prefix = data['texts'][date_index - 1]
    previous = data['texts'][date_index - 4: date_index]
    baseline = prefix['y'] + 12.12
    date_start_x = prefix['x'] + prefix['width']
    assert previous[1]['text'] == '/' and previous[2]['text'] == '8'
    assert previous[0]['text'] == ('1' if name == 'plan-completed-mobile' else '0')
    for mode in ['current', 'wireframe']:
        filename = f'{name}-{mode}-progress-text.svg'
        text_color = '#7f7280' if mode == 'current' else '#333333'
        border_color = '#e9e3ec' if mode == 'current' else '#a0a0a0'
        background = 'url(#patch-background)' if mode == 'current' else '#f3f3f3'
        parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
            f'<title>{escape(name)} — progress text repair — {mode}</title>',
            '<desc>Place at x 40, y 439 inside the matching original frame. Opaque background hides only the bad progress text line. Text remains editable.</desc>']
        if mode == 'current':
            # Actual screen gradient composited under the section's 72% white fill.
            parts.append('<defs><linearGradient id="patch-background" gradientUnits="userSpaceOnUse" x1="-40" y1="0" x2="335" y2="0"><stop offset="0" stop-color="#f9fcfe"/><stop offset="0.48" stop-color="#fcfcfd"/><stop offset="1" stop-color="#fdfafb"/></linearGradient></defs>')
        parts.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="{background}"/>')
        # Retain the narrow side borders already present in the imported asset.
        for border_x in (41, 334):
            parts.append(f'<line x1="{border_x-X}" y1="0" x2="{border_x-X}" y2="{H}" stroke="{border_color}" stroke-width="1"/>')
        for item in previous:
            parts.append(f'<text x="{item["x"]-X:.3f}" y="{baseline-Y:.3f}" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="400" fill="{text_color}">{escape(item["text"])}</text>')
        for dx, dy, label in [(date_start_x, baseline, '2026-10-'), (date['x'], baseline+18, '12')]:
            parts.append(f'<text x="{dx-X:.3f}" y="{dy-Y:.3f}" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="400" fill="{text_color}">{label}</text>')
        parts.append('</svg>')
        svg = '\n'.join(parts)+'\n'
        ET.fromstring(svg)
        (OUT / filename).write_text(svg)
        manifest['patches'].append({'file':filename,'target':name,'mode':mode,'x':X,'y':Y,'width':W,'height':H,'completed':int(previous[0]['text']),'planned':8,'source_date':'2026-10-12','baselines_in_original_frame':[round(baseline,3),round(baseline+18,3)]})

suspects=[]
for capture in sorted((ROOT / 'layout-captures').glob('*.json')):
    data=json.loads(capture.read_text())
    for i,t in enumerate(data.get('texts', [])):
        if t.get('synthetic') or t.get('lineHeight')=='normal': continue
        line_height=float(t['lineHeight'].replace('px',''))
        if t['height'] > line_height*1.45:
            suspects.append({'capture':capture.name,'text_index':i,'text':t['text'],'x':t['x'],'y':t['y'],'height':t['height'],'line_height':line_height,'patched_here':capture.stem in NAMES and t['text']=='2026-10-12'})
manifest['other_capture_fragments_to_review']=[s for s in suspects if not s['patched_here']]
(OUT / 'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT / 'README.md').write_text('''# Progress text overlays

These small SVG overlays repair the progress date in five mobile screen variants. Existing screen files and the Figma registry are unchanged.

Place each patch at **x 40, y 439** inside its matching original frame. Each patch is **295 × 37 px**. Use `current` for the coloured screen, and `wireframe` for the matching wireframe. Bring the patch above the captured SVG content. The overlay contains an opaque matching background and editable text with explicit baselines.

The date keeps the original value `2026-10-12`. At the JSON capture's 293 px content width, the date breaks after its last hyphen: `2026-10-` finishes the first line and `12` starts the second. The full-page screenshot has a wider content layout and keeps the date on one line. This patch follows the frame geometry already imported into Figma.

## Cause

`read-rendered-layout.js` splits each DOM text node on whitespace and asks `Range.getBoundingClientRect()` for each word. Browsers can wrap inside a word at hyphens. The returned rectangle is then a union of both lines. The exporter treats it as one line and draws the whole date at the union's left edge. That left edge is also the progress text's left edge, so the date overlaps `0/8 sessions completed`.

A durable capture fix needs per-line fragments, for example character ranges grouped by their rendered top coordinate. Replacing the measurement with `getClientRects()` alone is insufficient unless the source characters are assigned to each fragment. The current patch is narrow and does not change the shared capture script.

## Other affected fragments

The same tall-range pattern appears in mobile exposure text (`time-consuming`), mobile help status summaries (a wrapped date), and desktop skills (`self-awareness`). Exact captures and text values are recorded in `manifest.json`; they have not been changed here.

## Verification

- XML parsing passed for all ten overlays.
- The original completion value is preserved: `1/8` only in `plan-completed-mobile`, `0/8` in the other four.
- Both text baselines stay inside the patch bounds.
- Desktop plan variants have normal single-line date rectangles and do not need this date repair.
- The root Figma screenshot and local frontend screenshot were inspected. Figma placement and visual readback remain the parent's final check.
''')
print(json.dumps({'patch_count':len(manifest['patches']),'other_suspect_fragments':len(manifest['other_capture_fragments_to_review'])},indent=2))

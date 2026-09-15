# Editable text repairs

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

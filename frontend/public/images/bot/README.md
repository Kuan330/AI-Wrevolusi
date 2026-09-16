# Bot pet animations — `deepseek酱`

Two animation states of the petdex `deepseek` mascot, extracted for the website
bot avatar. **Only `idle` and `waving` are exported** — those are the two the
site uses.

Source: `npx petdex install deepseek` → `~/.codex/pets/deepseek/spritesheet.webp`
Atlas format: 8 cols × 9 rows = 1536×1872, **192×208 per frame**.

## Files

| File | Size | What it is |
|---|---|---|
| `idle_strip.webp` | 1152×208 | 6 frames in one horizontal strip → CSS `steps(6)` |
| `waving_strip.webp` | 1152×208 | same, for waving |
| `idle.gif` | 192×208 | looping GIF, 183 ms/frame — drop-in avatar |
| `waving.gif` | 192×208 | same |
| `idle_0.png` … `idle_5.png` | 192×208 | individual frames, transparent PNG |
| `waving_0.png` … `waving_5.png` | 192×208 | same |

All transparent (RGBA / alpha GIF). Paths resolve as `/images/bot/<file>` from
the site root — Vite serves `public/` verbatim.

## Usage

### Easiest: the GIF

```html
<img src="/images/bot/idle.gif" alt="" width="132" height="143" />
```

### Better control: the strip + CSS

The strip plays with one keyframe rule and no JS. Frame size is 192×208, so
`background-size: 1152px 208px` and animate `background-position-x` by one full
strip width.

```css
.pet {
  width: 192px;
  height: 208px;
  background-repeat: no-repeat;
  background-size: 1152px 208px;   /* 6 frames × 192px */
  animation: pet-play 1.1s steps(6) infinite;
}
.pet.idle   { background-image: url("/images/bot/idle_strip.webp"); }
.pet.waving { background-image: url("/images/bot/waving_strip.webp"); }

@keyframes pet-play {
  from { background-position-x: 0; }
  to   { background-position-x: -1152px; }
}
```

Scale it down with `transform: scale(...)` rather than resizing the element, so
the sprite math stays at the native 192×208:

```css
.pet-wrap { width: 132px; height: 143px; overflow: hidden; }
.pet      { transform: scale(0.6875); transform-origin: top left; }
```

Respect reduced motion:

```css
@media (prefers-reduced-motion: reduce) { .pet { animation: none; } }
```

### Suggested wiring

| Bot state | Animation |
|---|---|
| idle / no new message | `idle` |
| newly opened, greeting, unread bubble | `waving` |

## ⚠️ Why waving is ping-ponged, not sliced

**This atlas only draws 4 waving frames — columns 4 and 5 of the waving row are
fully transparent.** A naive "take the first 6 columns" slice produces two blank
frames, so the animation flashes empty mid-loop.

The exported strip therefore ping-pongs the four real frames:

```
frame index:  0  1  2  3  4  5
source col:   0  1  2  3  2  1
```

`idle` uses its six real frames in order (`0…5`). Every one of the 24 exported
frames was checked for non-empty alpha.

## Row order (for re-extraction)

Codex atlas row order, top to bottom:

```
0 idle            3 waving          6 waiting
1 running-right   4 jumping         7 running
2 running-left    5 failed          8 review
```

`idle` = row 0, `waving` = row 3.

## Regenerating

The extraction script lives **outside this repo** (it reads from `~/.codex/pets/`,
not from the project):

```
../bot-assets/extract_deepseek.py
```

It auto-detects drawn frames, skips transparent ones, ping-pongs short rows, and
asserts the atlas is 1536×1872. Run it with `python extract_deepseek.py`; it
rewrites the folder it lives in, then copy the files here.

To export other states, edit `ROWS` in that script (e.g. `{"idle": 0, "waving": 3,
"running": 7}`) — but the site currently uses only `idle` and `waving`.

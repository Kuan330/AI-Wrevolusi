#!/usr/bin/env python3
"""Build transparent radio/checkbox patches for already imported Figma frames."""

import argparse
import importlib.util
import json
from pathlib import Path
import xml.etree.ElementTree as ET

BASE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("review_boards", BASE / "build-review-boards.py")
if SPEC is None or SPEC.loader is None:
    raise ImportError("Cannot load the existing SVG builders")
REVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REVIEW)
BUILDER = REVIEW.BUILDER


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=BASE / "layout-captures")
    parser.add_argument("--output", type=Path, default=BASE / "form-overlays")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    entries = []
    for source in sorted(args.input.glob("*.json")):
        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or "controls" not in data:
            continue
        glyphs = [(index, item, BUILDER.form_control(data, source.name, index, item))
                  for index, item in enumerate(data["controls"]) if BUILDER.positive_rect(item)]
        glyphs = [(index, item, state) for index, item, state in glyphs if state]
        if not glyphs:
            continue
        bounds = ({key: BUILDER.number(data["boxes"][0][key]) for key in ("x", "y", "width", "height")}
                  if data.get("overlay") else {"x": 0, "y": 0, "width": BUILDER.number(data["width"]), "height": BUILDER.number(data["height"])})
        root = ET.Element(BUILDER.svg_tag("svg"), {"width": BUILDER.fmt(bounds["width"]),
            "height": BUILDER.fmt(bounds["height"]),
            "viewBox": f"0 0 {BUILDER.fmt(bounds['width'])} {BUILDER.fmt(bounds['height'])}",
            "id": "form-glyphs-" + source.stem})
        BUILDER.add(root, "title").text = source.stem + " · form glyph patch"
        defs = BUILDER.add(root, "defs")
        layer = BUILDER.add(root, "g", transform=f"translate({BUILDER.fmt(-bounds['x'])} {BUILDER.fmt(-bounds['y'])})")
        controls = []
        for index, item, state in glyphs:
            original_id = BUILDER.control_id(source.name, index, item)
            glyph_id = "patch-" + original_id
            parent = layer
            clip = item.get("clip")
            if isinstance(clip, dict) and BUILDER.positive_rect(clip):
                clip_id = "clip-" + glyph_id
                clip_node = BUILDER.add(defs, "clipPath", id=clip_id)
                BUILDER.add(clip_node, "rect", **BUILDER.geometry(clip))
                parent = BUILDER.add(layer, "g", clip_path=f"url(#{clip_id})")
            BUILDER.paint_form_glyph(parent, item, state, glyph_id)
            controls.append({"index": index+1, "id": original_id, "glyphId": glyph_id, **state,
                "x": BUILDER.number(item["x"])-bounds["x"], "y": BUILDER.number(item["y"])-bounds["y"],
                "width": BUILDER.number(item["width"]), "height": BUILDER.number(item["height"])})
        path = args.output / f"{source.stem}.svg"
        REVIEW.write_svg(path, root)
        entries.append({"stem": source.stem, "svg": path.name,
            "width": bounds["width"], "height": bounds["height"], "overlayBounds": bounds,
            "controls": controls})
    (args.output / "manifest.json").write_text(json.dumps({
        "method": "Transparent native form glyph patches; place at 0,0 in the existing corresponding Figma frame",
        "screens": entries,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(entries)} transparent form patches with {sum(len(entry['controls']) for entry in entries)} glyphs")


if __name__ == "__main__":
    main()

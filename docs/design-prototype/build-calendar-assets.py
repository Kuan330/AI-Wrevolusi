#!/usr/bin/env python3
"""Render complete captured calendar grids and independent sticky headers."""

from __future__ import annotations

import argparse
import copy
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


def scope_ids(root: ET.Element, prefix: str) -> dict[str, str]:
    mapping = REVIEW.prefix_ids(root, prefix)
    # Native hit names remain short while retaining variant and original index.
    shortened = {new: new[:100] for old, new in mapping.items() if old.startswith("hit-")}
    for node in root.iter():
        if node.attrib.get("id") in shortened:
            node.set("id", shortened[node.attrib["id"]])
    return {old: shortened.get(new, new) for old, new in mapping.items()}


def render_variant(data: dict, source: Path, output: Path) -> dict:
    viewport = data.get("calendarViewport")
    if not isinstance(viewport, dict) or BUILDER.number(viewport.get("headerHeight")) <= 0:
        raise ValueError(f"{source.name}: calendarViewport.headerHeight is required")
    if not BUILDER.positive_rect(data):
        raise ValueError(f"{source.name}: calendar content dimensions must be positive")
    stem = BUILDER.ascii_slug(source.stem)
    full_root = ET.fromstring(BUILDER.render_wireframe(data, source.name, high_fidelity=True)[0])
    full_mapping = scope_ids(full_root, f"cal-{stem}-")
    full_root.set("id", f"calendar-content-{stem}")
    anchor_id = f"anchor-calendar-{stem}-scroll"
    anchor_y = BUILDER.number(viewport.get("scrollTop"))
    BUILDER.add(full_root, "rect", id=anchor_id, x="0", y=BUILDER.fmt(anchor_y),
                width="1", height="1", fill="#ffffff", fill_opacity="0.001")
    full_path = output / f"{stem}.svg"
    REVIEW.write_svg(full_path, full_root)

    header_data = copy.deepcopy(data)
    header_height = BUILDER.number(viewport["headerHeight"])
    header_data["height"] = header_height
    header_data["name"] = "Calendar header · " + str(data.get("name") or stem)
    for kind in ("boxes", "texts", "images", "icons", "controls"):
        items = []
        for item in data.get(kind, []):
            if item.get("part") == "header":
                items.append({**item, "clip": {"x": 0, "y": 0,
                    "width": BUILDER.number(data["width"]), "height": header_height}})
            else:
                items.append({**item, "width": 0})
        header_data[kind] = items
    header_root = ET.fromstring(BUILDER.render_wireframe(header_data, source.name, high_fidelity=True)[0])
    header_mapping = scope_ids(header_root, f"cal-head-{stem}-")
    header_root.set("id", f"calendar-sticky-header-{stem}")
    header_path = output / f"{stem}-header.svg"
    REVIEW.write_svg(header_path, header_root)

    controls = []
    header_controls = []
    for index, item in enumerate(data.get("controls", [])):
        if not BUILDER.positive_rect(item):
            continue
        original_id = BUILDER.control_id(source.name, index, item)
        control = {"index": index + 1, "originalId": original_id,
            "id": full_mapping[original_id], "part": item.get("part", "body"),
            "label": str(item.get("label") or ""), "role": item.get("role"), "href": item.get("href"),
            **{key: BUILDER.number(item.get(key)) for key in ("x", "y", "width", "height")}}
        controls.append(control)
        if item.get("part") == "header":
            header_controls.append({**control, "id": header_mapping[original_id]})
    return {"stem": stem, "source": str(source.relative_to(BASE)) if source.is_relative_to(BASE) else str(source),
            "name": data.get("name") or stem,
            "contentSvg": full_path.name, "headerSvg": header_path.name,
            "width": BUILDER.number(data["width"]), "height": BUILDER.number(data["height"]),
            "headerHeight": header_height, "calendarViewport": viewport,
            "sourceViewport": data.get("sourceViewport"),
            "anchorId": anchor_id, "anchor": {"x": 0, "y": anchor_y, "width": 1, "height": 1},
            "headerRootId": f"calendar-sticky-header-{stem}",
            "controls": controls, "headerControls": header_controls,
            "headerHitIds": [control["id"] for control in header_controls]}


def plan_mobile_placements(layouts: Path) -> list[dict]:
    placements = []
    for source in sorted(layouts.glob("plan*mobile*.json")):
        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or BUILDER.number(data.get("width")) != 390 or data.get("overlay"):
            continue
        candidates = [item for item in data.get("boxes", [])
                      if abs(BUILDER.number(item.get("radius"))-16) < 0.01
                      and abs(BUILDER.number(item.get("borderWidth"))-1) < 0.01
                      and BUILDER.number(item.get("height")) > 400]
        placement = {"stem": source.stem, "candidateCount": len(candidates)}
        if len(candidates) == 1:
            container = {key: BUILDER.number(candidates[0][key]) for key in ("x", "y", "width", "height")}
            placement.update({"status": "matched", "container": container,
                "calendarViewport": {"x": container["x"]+1, "y": container["y"]+1,
                                     "width": 296, "height": 532}})
        else:
            placement["status"] = "ambiguous" if candidates else "not-found"
        placements.append(placement)
    return placements


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=BASE / "calendar-captures")
    parser.add_argument("--output", type=Path, default=BASE / "calendar-assets")
    parser.add_argument("--layouts", type=Path, default=BASE / "layout-captures")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    variants = []
    for source in sorted(args.input.glob("*.json")):
        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or "calendarViewport" not in data:
            continue
        variants.append(render_variant(data, source.resolve(), args.output))
    ids = [control["id"] for variant in variants for key in ("controls", "headerControls") for control in variant[key]]
    if len(ids) != len(set(ids)):
        raise ValueError("Calendar control IDs must be unique across all variants")
    (args.output / "manifest.json").write_text(json.dumps({
        "method": "Full captured calendar content with original grid-relative coordinates and separate sticky header",
        "figmaSetup": "Place full content at calendarViewport.x/y in a frame sized to calendarViewport.width/height. Enable horizontal and vertical scrolling. Place the separate header at 0/0 inside that frame and set it Sticky.",
        "planMobilePlacements": plan_mobile_placements(args.layouts),
        "variants": variants,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated {len(variants)} full calendar SVGs and {len(variants)} sticky header SVGs")


if __name__ == "__main__":
    main()

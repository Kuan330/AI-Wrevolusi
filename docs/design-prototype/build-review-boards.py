#!/usr/bin/env python3
"""Build editable wireframe boards and fixed-header SVGs from DOM captures.

Reuses build-wireframes.py and never changes capture JSONs or application files.
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET


BASE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("wireframe_builder", BASE / "build-wireframes.py")
if SPEC is None or SPEC.loader is None:
    raise ImportError("Cannot load build-wireframes.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)
SVG_NS = BUILDER.SVG_NS
tag, add, fmt, number = BUILDER.svg_tag, BUILDER.add, BUILDER.fmt, BUILDER.number


def prefix_ids(root: ET.Element, prefix: str) -> dict[str, str]:
    mapping = {node.attrib["id"]: prefix + node.attrib["id"]
               for node in root.iter() if "id" in node.attrib}
    for node in root.iter():
        for key, value in list(node.attrib.items()):
            local_key = key.rsplit("}", 1)[-1]
            if local_key == "id":
                value = mapping[value]
            elif local_key == "href" and value.startswith("#"):
                value = "#" + mapping.get(value[1:], value[1:])
            elif local_key in {"aria-labelledby", "aria-describedby"}:
                value = " ".join(mapping.get(part, part) for part in value.split())
            value = re.sub(r"url\(#([^\)]+)\)",
                           lambda match: f"url(#{mapping.get(match[1], match[1])})", value)
            node.attrib[key] = value
    return mapping


def validate_svg(root: ET.Element) -> None:
    ET.fromstring(ET.tostring(root, encoding="unicode"))
    ids = [node.attrib["id"] for node in root.iter() if "id" in node.attrib]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate SVG IDs")
    known = set(ids)
    for node in root.iter():
        for key, value in node.attrib.items():
            for target in re.findall(r"url\(#([^\)]+)\)", value):
                if target not in known:
                    raise ValueError(f"Unknown SVG reference: {target}")
            if key.rsplit("}", 1)[-1] == "href" and value.startswith("#") and value[1:] not in known:
                raise ValueError(f"Unknown SVG link: {value}")


def write_svg(path: Path, root: ET.Element) -> None:
    validate_svg(root)
    path.write_text(ET.tostring(root, encoding="unicode", xml_declaration=True), encoding="utf-8")


def create_board(name: str, entries: list[dict], destination: Path) -> dict:
    mobile = name.startswith("mobile")
    overlays = name.endswith("overlays")
    columns = min(len(entries), 5 if mobile and overlays else 3) or 1
    padding, gap, label_height = 48, 48, 50
    column_width = max((number(entry["data"]["width"]) for entry in entries), default=390 if mobile else 1440)
    column_heights = [160.0] * columns
    placements = []
    for entry in entries:
        column = min(range(columns), key=lambda index: column_heights[index])
        x = padding + column * (column_width + gap)
        y = column_heights[column]
        height = number(entry["data"]["height"])
        placements.append((entry, x, y, height))
        column_heights[column] += label_height + height + gap
    width = padding * 2 + columns * column_width + (columns - 1) * gap
    height = max(column_heights) + padding
    title = f"{'Mobile' if mobile else 'Desktop'} · {'Overlays' if overlays else 'Main pages'}"
    root = ET.Element(tag("svg"), {"width": fmt(width), "height": fmt(height),
        "viewBox": f"0 0 {fmt(width)} {fmt(height)}", "role": "img",
        "aria-labelledby": f"{name}-title"})
    add(root, "title", id=f"{name}-title").text = title + " — current frontend wireframes"
    add(root, "rect", id=f"{name}-background", x="0", y="0", width=fmt(width), height=fmt(height), fill="#f2f2f2")
    add(root, "text", x=fmt(padding), y="65", font_family="Inter, Arial, sans-serif",
        font_size="34", font_weight="600", fill="#252525").text = title + " · current frontend"
    add(root, "text", x=fmt(padding), y="105", font_family="Inter, Arial, sans-serif",
        font_size="18", fill="#555555").text = "Derived from actual DOM captures · original screen sizes · editable SVG text and shapes"
    placed = []
    for entry, x, y, screen_height in placements:
        stem, data = entry["stem"], entry["data"]
        group = add(root, "g", id=f"{name}-screen-{stem}")
        add(group, "text", x=fmt(x), y=fmt(y+22), font_family="Inter, Arial, sans-serif",
            font_size="18", font_weight="600", fill="#252525").text = (
                f"{stem} · viewport {fmt(data['width'])} × {fmt(data.get('viewportHeight', data['height']))}")
        nested = ET.fromstring(BUILDER.render_wireframe(data, entry["source"].name)[0])
        prefix_ids(nested, f"{name}-{stem}-")
        nested.set("id", f"{name}-{stem}-screen")
        nested.set("x", fmt(x))
        nested.set("y", fmt(y + label_height))
        group.append(nested)
        placed.append({"stem": stem, "x": x, "y": y+label_height,
            "width": number(data["width"]), "height": screen_height,
            "viewportHeight": number(data.get("viewportHeight", data["height"]))})
    path = destination / f"{name}.svg"
    write_svg(path, root)
    return {"name": name, "svg": path.name, "width": width, "height": height,
            "screenCount": len(entries), "screens": placed}


def intersect(a: dict, b: dict) -> dict:
    left = max(number(a["x"]), number(b["x"]))
    top = max(number(a["y"]), number(b["y"]))
    right = min(number(a["x"])+number(a["width"]), number(b["x"])+number(b["width"]))
    bottom = min(number(a["y"])+number(a["height"]), number(b["y"])+number(b["height"]))
    return {"x": left, "y": top, "width": max(0, right-left), "height": max(0, bottom-top)}


def create_sticky_header(entry: dict, destination: Path) -> dict:
    data = copy.deepcopy(entry["data"])
    viewport = {"x": 0, "y": 0, "width": number(data["width"]), "height": 64}
    original_controls = data.get("controls", [])
    for kind in ("boxes", "texts", "images", "icons", "controls"):
        clipped_items = []
        for item in data.get(kind, []):
            if not isinstance(item, dict):
                clipped_items.append({"width": 0, "height": 0})
                continue
            own_clip = item.get("clip")
            clip = intersect(own_clip, viewport) if isinstance(own_clip, dict) else viewport
            visible = intersect(item, clip)
            if BUILDER.positive_rect(visible):
                clipped_items.append({**item, "clip": clip})
            else:
                # Keep original array indexes for stable native control IDs.
                clipped_items.append({**item, "width": 0})
        data[kind] = clipped_items
    data["height"] = 64
    data["viewportHeight"] = 64
    data["name"] = "Sticky header · " + entry["stem"]
    root = ET.fromstring(BUILDER.render_wireframe(data, entry["source"].name, high_fidelity=True)[0])
    mapping = prefix_ids(root, "sticky-")
    root.set("id", "sticky-header-" + entry["stem"])
    path = destination / f"{entry['stem']}.svg"
    write_svg(path, root)
    controls = []
    for index, original in enumerate(original_controls):
        if not BUILDER.positive_rect(data["controls"][index]):
            continue
        original_id = BUILDER.control_id(entry["source"].name, index, original)
        controls.append({"index": index+1, "id": mapping[original_id], "originalId": original_id,
            "label": str(original.get("label") or ""), "href": original.get("href"),
            **{key: number(original.get(key)) for key in ("x", "y", "width", "height")}})
    return {"originalStem": entry["stem"], "svg": path.name,
            "width": number(data["width"]), "height": 64,
            "headerHitIds": [control["id"] for control in controls], "controls": controls}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=BASE / "layout-captures")
    parser.add_argument("--boards", type=Path, default=BASE / "wireframe-boards")
    parser.add_argument("--headers", type=Path, default=BASE / "sticky-headers")
    args = parser.parse_args()
    args.boards.mkdir(parents=True, exist_ok=True)
    args.headers.mkdir(parents=True, exist_ok=True)
    grouped = {key: [] for key in ("desktop-main-pages", "desktop-overlays", "mobile-main-pages", "mobile-overlays")}
    entries = []
    for source in sorted(args.input.glob("*.json")):
        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or "width" not in data or "height" not in data:
            continue
        mobile = "-mobile" in source.stem
        if mobile and abs(number(data["width"]) - 390) > 0.1:
            raise ValueError(f"{source.name}: mobile capture width must be 390")
        entry = {"stem": source.stem, "source": source, "data": data}
        entries.append(entry)
        key = ("mobile" if mobile else "desktop") + ("-overlays" if data.get("overlay") else "-main-pages")
        grouped[key].append(entry)
    boards = [create_board(name, screens, args.boards) for name, screens in grouped.items()]
    headers = [create_sticky_header(entry, args.headers) for entry in entries if not entry["data"].get("overlay")]
    (args.boards / "manifest.json").write_text(json.dumps({
        "method": "Wireframes derived from actual frontend captures at native screen dimensions",
        "boards": boards,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.headers / "manifest.json").write_text(json.dumps({
        "method": "Captured items intersecting the top 64 pixels; clip at 64 pixels",
        "headers": headers,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(boards)} editable boards containing {len(entries)} screens")
    print(f"Built {len(headers)} sticky headers with {sum(len(header['controls']) for header in headers)} unique hit rectangles")


if __name__ == "__main__":
    main()

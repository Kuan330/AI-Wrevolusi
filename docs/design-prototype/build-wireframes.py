#!/usr/bin/env python3
"""Build editable SVG wireframes from captured frontend DOM geometry.

Run from any directory. No application files, source captures or Figma nodes are
changed. Every SVG is derived from one JSON file; no example layout is invented.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import textwrap
import unicodedata
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlparse


SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)


def svg_tag(name: str) -> str:
    return f"{{{SVG_NS}}}{name}"


def number(value: object, default: float = 0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def fmt(value: object) -> str:
    return f"{number(value):.3f}".rstrip("0").rstrip(".") or "0"


def geometry(item: dict) -> dict[str, str]:
    return {key: fmt(item.get(key)) for key in ("x", "y", "width", "height")}


def add(parent: ET.Element, tag: str, **attributes: object) -> ET.Element:
    return ET.SubElement(
        parent, svg_tag(tag), {key.replace("_", "-"): str(value) for key, value in attributes.items()}
    )


def positive_rect(item: dict) -> bool:
    return number(item.get("width")) > 0 and number(item.get("height")) > 0


def ascii_slug(value: object) -> str:
    ascii_text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Za-z0-9_-]+", "-", ascii_text).strip("-") or "control"


def control_id(source_name: str, index: int, item: dict) -> str:
    label = item.get("label") or item.get("role") or "control"
    return f"hit-{ascii_slug(Path(source_name).stem)}-{index + 1}-{ascii_slug(label)}"[:100]


def control_manifest(data: dict, source_name: str, bounds: dict | None) -> list[dict]:
    controls = []
    for index, item in enumerate(data.get("controls", [])):
        if not isinstance(item, dict) or not positive_rect(item):
            continue
        rect = {key: number(item.get(key)) for key in ("x", "y", "width", "height")}
        controls.append({
            "index": index + 1,
            "id": control_id(source_name, index, item),
            "legacyControlId": f"controls-{index + 1}",
            "label": str(item.get("label") or ""),
            "role": item.get("role"),
            "href": item.get("href"),
            **rect,
            "croppedCoordinates": {**rect, "x": rect["x"] - bounds["x"],
                                    "y": rect["y"] - bounds["y"]} if bounds else None,
        })
    return controls


def form_control(data: dict, source_name: str, index: int, item: dict) -> dict | None:
    input_type = item.get("inputType")
    if input_type in {"radio", "checkbox"}:
        return {"inputType": input_type, "checked": bool(item.get("checked")),
                "accentColor": item.get("accentColor") or "#4f91ba", "basis": "captured"}
    if input_type or item.get("role") != "input" or max(number(item.get("width")), number(item.get("height"))) > 24:
        return None
    small = [i for i, control in enumerate(data.get("controls", []))
             if control.get("role") == "input" and max(number(control.get("width")), number(control.get("height"))) <= 24 and positive_rect(control)]
    if index not in small:
        return None
    ordinal = small.index(index)
    screen = re.sub(r"-(desktop|mobile)(?:-.*)?$", "", Path(source_name).stem)
    if screen == "focus" and ordinal < 4:
        input_type, checked = "radio", ordinal == 0
    elif screen in {"content", "content-start", "arrange-start"} and ordinal < 2:
        input_type, checked = "radio", ordinal == 0
    elif screen in {"routine", "routine-start"} and ordinal < 2:
        input_type, checked = "radio", ordinal == 1
    elif screen == "sign-in":
        input_type, checked = "checkbox", True
    elif screen == "activity":
        input_type, checked = "checkbox", False
    else:
        return None
    return {"inputType": input_type, "checked": checked, "accentColor": "#4f91ba",
            "basis": "confirmed source screenshot for legacy capture"}


def paint_form_glyph(parent: ET.Element, item: dict, state: dict, glyph_id: str, high_fidelity: bool = True) -> None:
    x, y, width, height = (number(item.get(key)) for key in ("x", "y", "width", "height"))
    size = min(width, height)
    accent = str(state.get("accentColor") or "#4f91ba")
    if accent == "auto":
        accent = "#4f91ba"
    if not high_fidelity:
        accent = "#626262"
    group = add(parent, "g", id=glyph_id, opacity="0.5" if item.get("disabled") else "1")
    add(group, "title").text = ("Checked " if state["checked"] else "Unchecked ") + state["inputType"]
    if state["inputType"] == "radio":
        add(group, "circle", cx=fmt(x+width/2), cy=fmt(y+height/2), r=fmt(max(0, (size-1)/2)),
            fill="#ffffff", stroke=accent if state["checked"] else "#767676", stroke_width="1")
        if state["checked"]:
            add(group, "circle", cx=fmt(x+width/2), cy=fmt(y+height/2), r=fmt(size*0.3), fill=accent)
    else:
        add(group, "rect", x=fmt(x+0.5), y=fmt(y+0.5), width=fmt(width-1), height=fmt(height-1),
            rx="2", fill=accent if state["checked"] else "#ffffff",
            stroke=accent if state["checked"] else "#767676", stroke_width="1")
        if state["checked"]:
            add(group, "path", d=f"M {fmt(x+width*0.22)} {fmt(y+height*0.51)} L {fmt(x+width*0.43)} {fmt(y+height*0.73)} L {fmt(x+width*0.8)} {fmt(y+height*0.25)}",
                fill="none", stroke="#ffffff", stroke_width="1.8", stroke_linecap="round", stroke_linejoin="round")


def synthetic_control(item: dict, controls: list[dict]) -> dict | None:
    """Recognise field text from older captures that lack synthetic:true."""
    matches = []
    for control in controls:
        if control.get("role") not in {"input", "textarea", "textbox", "searchbox"}:
            continue
        width = number(control.get("width"))
        dx = number(item.get("x")) - number(control.get("x"))
        dy = number(item.get("y")) - number(control.get("y"))
        if width > 40 and abs(number(item.get("width")) - (width - 20)) <= 1 and 1 <= dx <= 32 and 0 <= dy < number(control.get("height")):
            # Older synthetic captures vertically centred every field, even
            # textarea text. This identifies the correct overlapping field.
            expected_y = number(control.get("y")) + (number(control.get("height")) - number(item.get("height"))) / 2
            matches.append((abs(number(item.get("y")) - expected_y), control))
    return min(matches, key=lambda match: match[0])[1] if matches else None


def field_lines(content: str, width: float, font_size: float) -> list[str]:
    """Bound synthetic textarea text when individual DOM line ranges are absent."""
    columns = max(1, int(width / (font_size * 0.5)))
    wrapper = textwrap.TextWrapper(width=columns, break_long_words=True, break_on_hyphens=False,
                                  replace_whitespace=False, drop_whitespace=True)
    return [line for paragraph in content.split("\n") for line in (wrapper.wrap(paragraph) or [""])]


def css_parts(value: str) -> list[str]:
    parts, start, depth = [], 0, 0
    for index, char in enumerate(value):
        depth += int(char == "(") - int(char == ")")
        if char == "," and depth == 0:
            parts.append(value[start:index].strip())
            start = index + 1
    parts.append(value[start:].strip())
    return parts


def colour(value: object) -> tuple[str, float]:
    value = str(value or "none")
    match = re.fullmatch(r"rgba?\(([^)]+)\)", value)
    if match:
        values = [number(v.strip()) for v in match.group(1).split(",")]
        rgb = "#" + "".join(f"{max(0, min(255, round(v))):02x}" for v in values[:3])
        return rgb, values[3] if len(values) > 3 else 1
    return ("none", 0) if value == "transparent" else (value, 1)


def local_image_data(src: str) -> str | None:
    parsed = urlparse(src)
    if parsed.scheme == "data":
        return src if src.startswith("data:image/") else None
    if parsed.netloc and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        return None
    relative = unquote(parsed.path).lstrip("/")
    root = Path(__file__).resolve().parents[2] / "frontend"
    for asset_root in (root / "dist", root / "public"):
        candidate = (asset_root / relative).resolve()
        if candidate.is_relative_to(asset_root.resolve()) and candidate.is_file():
            mime = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
            if mime.startswith("image/"):
                return f"data:{mime};base64," + base64.b64encode(candidate.read_bytes()).decode("ascii")
    return None


def paint_image(group: ET.Element, item: dict, image_data: str, prefix: str, aspect: str) -> None:
    if image_data.startswith("data:image/svg+xml"):
        header, payload = image_data.split(",", 1)
        markup = base64.b64decode(payload).decode("utf-8") if ";base64" in header else unquote(payload)
        append_icon(group, {**item, "markup": markup}, prefix, high_fidelity=True)
        group[-1].set("preserveAspectRatio", aspect)
    else:
        # SVG 1.1 image links remain supported by browsers and Figma's importer.
        add(group, "image", **geometry(item), **{f"{{{XLINK_NS}}}href": image_data},
            preserveAspectRatio=aspect)


def gradient(defs: ET.Element, value: str, item: dict, gradient_id: str) -> str | None:
    match = re.fullmatch(r"(linear|radial)-gradient\((.*)\)", value)
    if not match:
        return None
    kind, body = match.groups()
    parts = css_parts(body)
    x, y, w, h = (number(item.get(key)) for key in ("x", "y", "width", "height"))
    if kind == "linear":
        angle = 180
        if re.fullmatch(r"-?[\d.]+deg", parts[0]):
            angle = number(parts.pop(0)[:-3])
        elif parts[0].startswith("to "):
            angle = {"to top": 0, "to right": 90, "to bottom": 180, "to left": 270,
                     "to top right": 45, "to bottom right": 135, "to bottom left": 225,
                     "to top left": 315}.get(parts.pop(0), 180)
        dx, dy = math.sin(math.radians(angle)), -math.cos(math.radians(angle))
        extent = (abs(w * dx) + abs(h * dy)) / 2
        node = add(defs, "linearGradient", id=gradient_id, gradientUnits="userSpaceOnUse",
            x1=fmt(x+w/2-dx*extent), y1=fmt(y+h/2-dy*extent),
            x2=fmt(x+w/2+dx*extent), y2=fmt(y+h/2+dy*extent))
    else:
        cx, cy = w / 2, h / 2
        if parts[0].startswith(("circle", "ellipse", "at ")):
            spec = parts.pop(0)
            position = re.search(r"at ([\d.]+)(px|%) ([\d.]+)(px|%)", spec)
            if position:
                cx = number(position[1]) * (w / 100 if position[2] == "%" else 1)
                cy = number(position[3]) * (h / 100 if position[4] == "%" else 1)
        radius = max(math.hypot(px-cx, py-cy) for px, py in ((0, 0), (w, 0), (0, h), (w, h)))
        node = add(defs, "radialGradient", id=gradient_id, gradientUnits="userSpaceOnUse",
            cx=fmt(x+cx), cy=fmt(y+cy), r=fmt(radius))
    stops = []
    for part in parts:
        stop = re.fullmatch(r"(rgba?\([^)]+\)|#[a-fA-F0-9]+|[a-zA-Z]+)(?:\s+([\d.]+)%)?", part)
        if stop:
            stops.append([stop[1], number(stop[2]) / 100 if stop[2] else None])
    if not stops:
        defs.remove(node)
        return None
    stops[0][1] = stops[0][1] if stops[0][1] is not None else 0
    stops[-1][1] = stops[-1][1] if stops[-1][1] is not None else 1
    previous = 0
    for index in range(1, len(stops)):
        if stops[index][1] is not None:
            for missing in range(previous + 1, index):
                stops[missing][1] = stops[previous][1] + (stops[index][1] - stops[previous][1]) * (missing - previous) / (index - previous)
            previous = index
    for fill, offset in stops:
        paint, alpha = colour(fill)
        add(node, "stop", offset=fmt(offset), stop_color=paint, stop_opacity=fmt(alpha))
    return f"url(#{gradient_id})"


def paint_box(group: ET.Element, defs: ET.Element, item: dict, serial: int, radius: float) -> None:
    fill, alpha = colour(item.get("fill"))
    border, border_alpha = colour(item.get("borderColor"))
    group.set("opacity", fmt(number(item.get("opacity"), 1)))
    rect_attrs = {**geometry(item), "rx": fmt(max(0, radius))}
    # A soft shadow uses the first visible captured CSS shadow. Extra stacked
    # shadows and backdrop blur remain a documented SVG-import limitation.
    shadow = None
    for layer in css_parts(str(item.get("shadow", "none"))):
        match = re.fullmatch(r"(rgba?\([^)]+\)) (-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px (-?[\d.]+)px", layer)
        if match and colour(match[1])[1] > 0:
            shadow = match
            break
    filter_id = None
    if shadow:
        filter_id = f"shadow-{serial}"
        node = add(defs, "filter", id=filter_id, x="-30%", y="-30%", width="160%", height="160%", color_interpolation_filters="sRGB")
        paint, opacity = colour(shadow[1])
        add(node, "feDropShadow", dx=shadow[2], dy=shadow[3], stdDeviation=fmt(number(shadow[4])/2), flood_color=paint, flood_opacity=fmt(opacity))
    attrs = {**rect_attrs, "fill": fill, "fill_opacity": fmt(alpha)}
    if filter_id:
        group.set("filter", f"url(#{filter_id})")
    add(group, "rect", **attrs)
    layers = css_parts(str(item.get("backgroundImage", "none")))
    for layer_index, layer in reversed(list(enumerate(layers))):
        gradient_fill = gradient(defs, layer, item, f"gradient-{serial}-{layer_index}")
        if gradient_fill:
            add(group, "rect", **rect_attrs, fill=gradient_fill)
        elif layer.startswith("url("):
            src = layer[4:-1].strip("\"'")
            image_data = local_image_data(src)
            if image_data:
                clip_id = f"background-clip-{serial}-{layer_index}"
                clip_node = add(defs, "clipPath", id=clip_id)
                add(clip_node, "rect", **rect_attrs)
                image_group = add(group, "g", clip_path=f"url(#{clip_id})")
                paint_image(image_group, item, image_data, f"background-{serial}-{layer_index}-", "xMidYMid slice")
    if number(item.get("borderWidth")):
        add(group, "rect", **rect_attrs, fill="none", stroke=border,
            stroke_opacity=fmt(border_alpha), stroke_width=fmt(item["borderWidth"]))


def append_icon(group: ET.Element, item: dict, prefix: str, high_fidelity: bool = False) -> None:
    """Keep source SVG geometry; remove executable or external content."""
    icon = ET.fromstring(str(item["markup"]))
    if icon.tag.rsplit("}", 1)[-1] != "svg":
        raise ValueError("Captured icon markup must have an SVG root")
    for parent in list(icon.iter()):
        for child in list(parent):
            if child.tag.rsplit("}", 1)[-1] in {"script", "foreignObject", "style", "image"}:
                parent.remove(child)
    ids = {node.attrib["id"]: prefix + node.attrib["id"] for node in icon.iter() if "id" in node.attrib}
    for node in icon.iter():
        if not node.tag.startswith("{"):
            node.tag = svg_tag(node.tag)
        for key, value in list(node.attrib.items()):
            local_key = key.rsplit("}", 1)[-1]
            if local_key.startswith("on") or local_key == "style":
                del node.attrib[key]
                continue
            if local_key == "href" and not value.startswith("#"):
                del node.attrib[key]
                continue
            if local_key == "id":
                value = ids[value]
            elif local_key == "href" and value[1:] in ids:
                value = "#" + ids[value[1:]]
            for old_id, new_id in ids.items():
                value = value.replace(f"url(#{old_id})", f"url(#{new_id})")
            if local_key in {"fill", "stroke", "color"} and value not in {"none", "transparent"} and not value.startswith("url("):
                value = str(item.get("color", "#333333")) if high_fidelity and value == "currentColor" else value if high_fidelity else "#333333"
            node.attrib[key] = value
    icon.attrib.update(geometry(item))
    icon.set("color", str(item.get("color", "#333333")) if high_fidelity else "#333333")
    group.append(icon)


def render_wireframe(data: dict, source_name: str, high_fidelity: bool = False) -> tuple[str, dict[str, int]]:
    width, height = number(data.get("width")), number(data.get("height"))
    if width <= 0 or height <= 0:
        raise ValueError(f"{source_name}: width and height must be positive")
    name = str(data.get("name") or Path(source_name).stem)
    root = ET.Element(svg_tag("svg"), {
        "width": fmt(width), "height": fmt(height),
        "viewBox": f"0 0 {fmt(width)} {fmt(height)}",
        "role": "img", "aria-labelledby": "screen-title screen-description",
    })
    add(root, "title", id="screen-title").text = name
    add(root, "desc", id="screen-description").text = (
        ("Editable frontend screen with captured colours and geometry. " if high_fidelity else "Editable low-fidelity wireframe derived from captured current frontend DOM coordinates. ")
        + "This is a local review asset, not a completed Figma screen."
    )
    add(root, "metadata").text = json.dumps({
        "source": source_name,
        "url": data.get("url"),
        "screenshot": data.get("screenshot"),
        "method": "Captured DOM geometry; captured colours" if high_fidelity else "Captured DOM geometry; neutral fills; editable SVG text and shapes",
        "limitations": "Backdrop blur and extra stacked shadows are not recreated; SVG font rendering and importer support may vary.",
    }, ensure_ascii=False)
    defs = add(root, "defs")
    clip = add(defs, "clipPath", id="viewport")
    add(clip, "rect", x="0", y="0", width=fmt(width), height=fmt(height))
    add(root, "rect", id="canvas", x="0", y="0", width=fmt(width), height=fmt(height), fill="#ffffff")
    canvas = add(root, "g", id="captured-screen", clip_path="url(#viewport)")
    counts = {kind: 0 for kind in ("boxes", "images", "icons", "controls", "texts")}
    items = [
        (kind, index, item)
        for kind in counts
        for index, item in enumerate(data.get(kind, []))
        if isinstance(item, dict) and positive_rect(item)
    ]
    # DOM capture may supply a global painter order, including modal layers.
    # Without one, preserve the supplied order within each geometry collection.
    if items and all("order" in item for _, _, item in items):
        items.sort(key=lambda record: number(record[2]["order"]))

    for serial, (kind, index, item) in enumerate(items):
        attrs = {"id": "wrap-" + control_id(source_name, index, item) if kind == "controls" else f"{kind}-{index + 1}"}
        item_clip = item.get("clip")
        if isinstance(item_clip, dict) and positive_rect(item_clip):
            overlay_root = data.get("boxes", [{}])[0]
            # Four early desktop drawers captured the hidden body's 15px
            # scrollbar gutter as a clip. Their screenshots confirm that the
            # fixed dialog itself reaches the full 1440px viewport edge.
            if (data.get("overlay") and width == 1440 and
                    number(overlay_root.get("x")) + number(overlay_root.get("width")) == 1440 and
                    tuple(number(item_clip.get(key)) for key in ("x", "y", "width", "height")) == (0, 0, 1425, 1000)):
                item_clip = {**item_clip, "width": 1440}
            clip_id = f"clip-{serial}"
            item_clip_node = add(defs, "clipPath", id=clip_id)
            add(item_clip_node, "rect", **geometry(item_clip))
            attrs["clip_path"] = f"url(#{clip_id})"
        group = add(canvas, "g", **attrs)
        if kind == "boxes":
            radius = min(number(item.get("radius")), number(item["width"]) / 2, number(item["height"]) / 2)
            if high_fidelity:
                paint_box(group, defs, item, serial, radius)
                counts[kind] += 1
                continue
            border = number(item.get("borderWidth"))
            box_kind = str(item.get("kind", "container"))
            fill = "#f3f3f3" if item.get("background") else "none"
            if box_kind in {"button", "input", "textarea", "select"} and item.get("background"):
                fill = "#e5e5e5" if box_kind == "button" else "#ffffff"
            add(group, "title").text = box_kind
            add(group, "rect", **geometry(item), rx=fmt(max(0, radius)), fill=fill,
                stroke="#a0a0a0" if border else "none", stroke_width=fmt(border))
        elif kind == "images":
            x, y, w, h = (number(item.get(key)) for key in ("x", "y", "width", "height"))
            alt = str(item.get("alt") or "Image")
            add(group, "title").text = alt
            image_data = local_image_data(str(item.get("src", ""))) if high_fidelity else None
            if image_data:
                paint_image(group, item, image_data, f"image-{serial}-",
                    {"cover": "xMidYMid slice", "fill": "none"}.get(item.get("objectFit"), "xMidYMid meet"))
                counts[kind] += 1
                continue
            add(group, "rect", **geometry(item), fill="#eeeeee", stroke="#a0a0a0", stroke_width="1")
            add(group, "path", d=f"M {fmt(x)} {fmt(y)} L {fmt(x+w)} {fmt(y+h)} M {fmt(x+w)} {fmt(y)} L {fmt(x)} {fmt(y+h)}",
                fill="none", stroke="#cccccc", stroke_width="1")
            if w >= 48 and h >= 24:
                label = alt[:max(6, min(48, int(w / 7)))]
                if len(label) < len(alt):
                    label = label[:-1] + "…"
                text = add(group, "text", x=fmt(x+w/2), y=fmt(y+h/2+4.2), text_anchor="middle",
                    font_family="Arial, sans-serif", font_size="12",
                    fill="#555555", stroke="#eeeeee", stroke_width="4", paint_order="stroke")
                text.text = label
        elif kind == "icons":
            append_icon(group, item, f"icon-{serial}-", high_fidelity)
        elif kind == "controls":
            # A tiny nonzero fill keeps the exact hit rectangle in Figma's SVG
            # importer. The canonical ID belongs to the rect because an importer
            # may collapse its clipping wrapper and discard that group's name.
            add(group, "title").text = str(item.get("label") or item.get("role") or "Control")
            add(group, "desc").text = json.dumps({key: item[key] for key in ("role", "label", "href") if key in item}, ensure_ascii=False)
            state = form_control(data, source_name, index, item)
            if state:
                paint_form_glyph(group, item, state, "glyph-" + control_id(source_name, index, item), high_fidelity)
            add(group, "rect", id=control_id(source_name, index, item), **geometry(item),
                fill="#ffffff", fill_opacity="0.001", stroke="none")
        else:
            content = str(item.get("text", ""))
            font_size = max(1, number(item.get("fontSize"), 16))
            line_height = number(str(item.get("lineHeight", "")).removesuffix("px"), font_size * 1.2)
            if line_height <= 0:
                line_height = font_size * 1.2
            font_family = str(item.get("fontFamily") or "Inter, Arial, sans-serif")
            control = synthetic_control(item, data.get("controls", []))
            synthetic = bool(item.get("synthetic")) or control is not None
            multiline = synthetic and (item.get("multiline") or (control is not None and control.get("role") == "textarea"))
            lines = field_lines(content, number(item.get("width")), font_size) if multiline else content.split("\n")
            text_y = number(item["y"])
            if multiline and not item.get("synthetic") and control is not None:
                # Source screenshots confirm equal 12px field padding plus a
                # 1px border. The measured horizontal inset supplies that value.
                text_y = number(control["y"]) + number(item["x"]) - number(control["x"])
            # Captured Range heights contain the font ascent and descent. Inter's
            # descent is about 0.24 em; use the capture's explicit baseline when
            # available, otherwise subtract that descent from its measured box.
            ascent = max(font_size * 0.75, min(number(item["height"]), font_size * 1.1,
                                              number(item["height"]) - font_size * 0.24))
            baseline = number(item.get("baseline"), text_y + ascent)
            for line_index, line in enumerate(lines):
                if not line:
                    continue
                attributes = {
                    "x": fmt(item["x"]), "y": fmt(baseline + line_index * line_height),
                    "font_family": font_family, "font_size": fmt(font_size),
                    "font_weight": str(item.get("fontWeight") or "400"),
                    "fill": colour(item.get("fill") or item.get("color") or "#333333")[0] if high_fidelity else "#333333",
                    "xml:space": "preserve",
                }
                if high_fidelity:
                    attributes["fill_opacity"] = fmt(colour(item.get("fill") or item.get("color") or "#333333")[1])
                if item.get("letterSpacing") not in {None, "normal"}:
                    attributes["letter_spacing"] = fmt(number(str(item["letterSpacing"]).removesuffix("px")))
                # Capture individual line fragments to retain their exact wrap.
                if not synthetic and len(lines) == 1 and line.strip():
                    attributes["textLength"] = fmt(item["width"])
                    attributes["lengthAdjust"] = "spacingAndGlyphs"
                add(group, "text", **attributes).text = line
        counts[kind] += 1

    return ET.tostring(root, encoding="unicode", xml_declaration=True), counts


def figma_asset(svg: str, data: dict) -> tuple[str, dict | None, str | None]:
    """Crop native overlay imports without changing comparison SVGs."""
    if not data.get("overlay"):
        return svg, None, None
    first_box = next((box for box in data.get("boxes", []) if positive_rect(box)), None)
    if first_box is None:
        raise ValueError(f"{data.get('name')}: an overlay requires a captured dialog box")
    bounds = {key: number(first_box[key]) for key in ("x", "y", "width", "height")}
    root = ET.fromstring(svg)
    root.set("width", fmt(bounds["width"]))
    root.set("height", fmt(bounds["height"]))
    root.set("viewBox", f"0 0 {fmt(bounds['width'])} {fmt(bounds['height'])}")
    root.set("overflow", "hidden")
    for child in list(root):
        if child.attrib.get("id") == "canvas":
            root.remove(child)
        elif child.attrib.get("id") == "captured-screen":
            child.set("transform", f"translate({fmt(-bounds['x'])} {fmt(-bounds['y'])})")
    right_aligned = abs(bounds["x"] + bounds["width"] - number(data["width"])) < 1
    position = "TOP_RIGHT" if right_aligned and abs(bounds["y"]) < 1 else "CENTER"
    metadata = root.find(svg_tag("metadata"))
    if metadata is not None:
        details = json.loads(metadata.text or "{}")
        details.update({"overlayBounds": bounds, "nativeOverlayPosition": position,
                        "canvasOutsideDialog": "transparent"})
        metadata.text = json.dumps(details, ensure_ascii=False)
    return ET.tostring(root, encoding="unicode", xml_declaration=True), bounds, position


def screenshot_link(data: dict, source: Path, output_dir: Path) -> str | None:
    screenshot = data.get("screenshot")
    if not isinstance(screenshot, str) or not screenshot:
        return None
    path = Path(screenshot)
    if path.is_absolute():
        choices = [path]
    else:
        choices = [source.parent / path, source.parent.parent / path,
                   source.parent.parent / "frontend-captures" / path]
    resolved = next((candidate.resolve() for candidate in choices if candidate.is_file()), None)
    return os.path.relpath(resolved, output_dir) if resolved else None


def build_gallery(entries: list[dict], output_dir: Path, high_fidelity: bool = False) -> None:
    def esc(value: object) -> str:
        return html.escape(str(value), quote=True)

    cards = []
    for entry in entries:
        image = (
            f'<a href="{esc(entry["screenshot"])}"><img src="{esc(entry["screenshot"])}" '
            f'alt="Actual frontend: {esc(entry["name"])}" loading="lazy"></a>'
            if entry["screenshot"] else '<p class="missing">No matching screenshot was supplied.</p>'
        )
        cards.append(f'''<section class="screen" id="{esc(entry['stem'])}">
<h2>{esc(entry['name'])}</h2>
<p class="meta">{esc(entry['width'])} × {esc(entry['height'])} CSS pixels · Captured existing behaviour</p>
<div class="pair"><figure><figcaption>Actual frontend screenshot</figcaption>{image}</figure>
<figure><figcaption>{'Captured editable screen' if high_fidelity else 'Derived editable wireframe'} · <a href="{esc(entry['svg'])}" download>Download SVG</a>{' · <a href="' + esc(entry['figmaSvg']) + '" download>Figma import SVG</a>' if high_fidelity and entry.get('figmaSvg') else ''}</figcaption>
<a href="{esc(entry['svg'])}"><img src="{esc(entry['svg'])}" alt="Derived wireframe: {esc(entry['name'])}" loading="lazy"></a></figure></div>
<p class="meta">Source: <a href="{esc(entry['source'])}">{esc(entry['source_name'])}</a> · {entry['counts']['texts']} text fragments · {entry['counts']['boxes']} shapes · {entry['counts']['controls']} control regions</p>
</section>''')
    links = "".join(f'<a href="#{esc(entry["stem"])}">{esc(entry["name"])}</a>' for entry in entries)
    content = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI-Wrevolusi · {'Captured screen assets' if high_fidelity else 'Derived frontend wireframes'}</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;color:#242424;background:#f3f3f3;font:15px/1.5 system-ui,sans-serif}}main{{max-width:1700px;margin:auto;padding:32px}}header{{max-width:950px}}h1{{font-size:32px;line-height:1.2}}h2{{font-size:21px;margin:0}}a{{color:#185f89}}.notice{{padding:16px;border:1px solid #b7b7b7;background:white}}nav{{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}}nav a{{padding:6px 10px;border:1px solid #c4c4c4;background:#fff;font-size:13px}}.screen{{margin:32px 0 56px;padding:20px;background:#fff;border:1px solid #c6c6c6;scroll-margin-top:16px}}.meta{{color:#555;font-size:13px;margin:8px 0 16px;overflow-wrap:anywhere}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}}figure{{margin:0;min-width:0}}figcaption{{margin-bottom:8px;font-weight:600}}figure img{{display:block;width:100%;height:auto;border:1px solid #c8c8c8;background:white}}.missing{{padding:30px;border:1px dashed #999}}@media(max-width:760px){{main{{padding:16px}}.screen{{padding:12px}}.pair{{grid-template-columns:1fr}}h1{{font-size:27px}}}}
</style></head><body><main><header><p>AI-WREVOLUSI · EXISTING FRONTEND</p>
<h1>{'Editable assets from actual screens' if high_fidelity else 'Wireframes derived from actual screens'}</h1>
<p>These {len(entries)} assets keep the measured desktop and mobile layouts, text fragments, card shapes and control positions from the current frontend. {'Captured colours, gradients and available local images are included.' if high_fidelity else 'Colours and images are reduced to neutral shapes.'}</p>
<p class="notice">These are local editable SVG review assets. They are <strong>not completed Figma screens</strong> and do not include Figma prototype links. Proposed Iteration 2 changes and future concepts are separate from this existing-behaviour gallery.</p>
<p>Open either image for its original size. SVG text and shapes remain editable. Text metrics can differ when the captured font is unavailable. {'Backdrop blur, extra stacked shadows and browser-specific rendering may differ; compare each imported Figma screen before approval.' if high_fidelity else 'Image artwork is represented by labelled placeholders.'}</p>
</header><nav aria-label="Screens">{links}</nav>{''.join(cards) or '<p>No layout JSON files are available yet. Run the generator after capturing the frontend.</p>'}
</main></body></html>'''
    (output_dir / "index.html").write_text(content, encoding="utf-8")


def main() -> None:
    base = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=base / "layout-captures")
    parser.add_argument("--output", type=Path, default=base / "wireframes")
    parser.add_argument("--screens", type=Path, default=base / "screen-assets")
    args = parser.parse_args()
    output_dir = args.output.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    screens_dir = args.screens.resolve()
    screens_dir.mkdir(parents=True, exist_ok=True)
    figma_dir = screens_dir / "figma"
    figma_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    screen_entries = []
    seen_stems = set()
    for source in sorted(args.input.glob("*.json")):
        data = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or "width" not in data or "height" not in data:
            continue  # A directory may also contain a capture manifest.
        if re.search(r"(?:^|-)mobile(?:$|-)", source.stem) and abs(number(data["width"]) - 390) > 0.1:
            raise ValueError(f"{source.name}: mobile captures must have width 390, got {data['width']}")
        stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", source.stem).strip("-") or "screen"
        if stem in seen_stems:
            raise ValueError(f"Output filename collision: {source.name}")
        seen_stems.add(stem)
        svg, counts = render_wireframe(data, source.name)
        ET.fromstring(svg)  # Catch invalid XML before writing a derived asset.
        (output_dir / f"{stem}.svg").write_text(svg, encoding="utf-8")
        coloured_svg, _ = render_wireframe(data, source.name, high_fidelity=True)
        ET.fromstring(coloured_svg)
        (screens_dir / f"{stem}.svg").write_text(coloured_svg, encoding="utf-8")
        native_svg, overlay_bounds, overlay_position = figma_asset(coloured_svg, data)
        ET.fromstring(native_svg)
        (figma_dir / f"{stem}.svg").write_text(native_svg, encoding="utf-8")
        entries.append({
            "stem": stem, "name": data.get("name") or source.stem,
            "width": fmt(data["width"]), "height": fmt(data["height"]),
            "viewportHeight": number(data.get("viewportHeight"), number(data["height"])),
            "svg": f"{stem}.svg", "screenshot": screenshot_link(data, source, output_dir),
            "source": os.path.relpath(source.resolve(), output_dir),
            "source_name": source.name, "counts": counts,
            "controls": control_manifest(data, source.name, overlay_bounds),
        })
        screen_entries.append({**entries[-1],
            "screenshot": screenshot_link(data, source, screens_dir),
            "source": os.path.relpath(source.resolve(), screens_dir),
            "figmaSvg": f"figma/{stem}.svg",
            "overlay": bool(data.get("overlay")),
            "overlayBounds": overlay_bounds,
            "nativeOverlayPosition": overlay_position,
            "figmaWidth": overlay_bounds["width"] if overlay_bounds else number(data["width"]),
            "figmaHeight": overlay_bounds["height"] if overlay_bounds else number(data["height"])})
    build_gallery(entries, output_dir)
    build_gallery(screen_entries, screens_dir, high_fidelity=True)
    (output_dir / "manifest.json").write_text(json.dumps({
        "method": "Derived from actual current frontend DOM captures",
        "figmaComplete": False,
        "screens": entries,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (screens_dir / "manifest.json").write_text(json.dumps({
        "method": "Captured frontend geometry, colours and available local images",
        "figmaComplete": False,
        "screens": screen_entries,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated {len(entries)} editable SVG wireframes and gallery: {output_dir / 'index.html'}")
    print(f"Generated {len(entries)} editable colour screen assets and gallery: {screens_dir / 'index.html'}")


if __name__ == "__main__":
    main()

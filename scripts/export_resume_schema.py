"""Export the pinned RenderCV schema for browser validation (no network required)."""
import json
from importlib.metadata import version
from pathlib import Path


def normalize(value):
    if isinstance(value, dict):
        # RenderCV 2.8 emits null description annotations for entry unions.
        # Remove only invalid annotations, not constraints or unknown fields.
        return {key: normalize(child) for key, child in value.items()
                if not (key in {"description", "title"} and not isinstance(child, str))}
    if isinstance(value, list):
        return [normalize(child) for child in value]
    return value


if __name__ == "__main__":
    from rendercv.schema.models.rendercv_model import RenderCVModel
    if version("rendercv") != "2.8":
        raise SystemExit("Use backend's locked RenderCV 2.8 environment.")
    target = Path(__file__).resolve().parents[1] / "frontend/src/features/resume/rendercv-2.8.schema.json"
    target.write_text(json.dumps(normalize(RenderCVModel.model_json_schema()), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model
    schema = normalize(RenderCVModel.model_json_schema())
    metadata = {"version": "2.8", "themes": {}, "locales": {}, "definitions": {"themes": {}, "locales": {}}}
    for name, definition in schema["$defs"].items():
        properties = definition.get("properties", {})
        if "theme" in properties and "const" in properties["theme"]:
            theme = properties["theme"]["const"]
            _, model = build_rendercv_dictionary_and_model(json.dumps({"cv": {}, "design": {"theme": theme}}), input_file_path=None)
            design = model.model_dump(mode="json")["design"]
            design.pop("templates", None)
            for key in list(design.get("header", {})):
                if key.startswith("photo"):
                    del design["header"][key]
            metadata["themes"][theme] = design
            metadata["definitions"]["themes"][theme] = name
        if "language" in properties and "const" in properties["language"]:
            language = properties["language"]["const"]
            _, model = build_rendercv_dictionary_and_model(json.dumps({"cv": {}, "locale": {"language": language}}), input_file_path=None)
            metadata["locales"][language] = model.model_dump(mode="json")["locale"]
            metadata["definitions"]["locales"][language] = name
    _, model = build_rendercv_dictionary_and_model('{"cv": {}}', input_file_path=None)
    metadata["settings"] = {key: value for key, value in model.model_dump(mode="json")["settings"].items() if key in {"current_date", "bold_keywords", "pdf_title"}}
    metadata_target = target.with_name("rendercv-2.8.controls.json")
    metadata_target.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

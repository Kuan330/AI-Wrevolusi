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

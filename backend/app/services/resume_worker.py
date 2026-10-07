"""Private worker, fixed paths, no shell, no user-supplied theme/template code."""
import json
import sys
from pathlib import Path

def main():
    from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model
    from rendercv.renderer.typst import generate_typst
    from rendercv.renderer import pdf_png
    from rendercv.renderer.pdf_png import generate_pdf
    import shutil
    import tomllib
    from rendercv.exception import RenderCVUserValidationError
    from app.services.resume_render import validate_render_document
    from rendercv.renderer.templater import markdown_parser

    # The CLI intentionally preserves raw Typst, but a public endpoint must not.
    # Keep generated Markdown bold/italic/link nodes; escape user literals and
    # quoted link URLs. No template or executable input is accepted.
    escape = {c: "\\" + c for c in '[]\\"#$@%~_/><*'}
    markdown_parser.escape_typst_characters = lambda text: text.translate(str.maketrans(escape))
    original_converter = markdown_parser.to_typst_string
    def safe_markdown(element):
        for child in element.iter():
            if child.tag == "a" and child.get("href"):
                href = child.get("href")
                child.set("href", href.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r"))
        return original_converter(element)
    markdown_parser.md.output_formats["typst"] = safe_markdown
    markdown_parser.md.set_output_format("typst")

    directory = Path(sys.argv[1]).resolve()
    try:
        document = validate_render_document(json.loads(sys.stdin.buffer.read().decode("utf-8")))
        _, model = build_rendercv_dictionary_and_model(
            json.dumps(document, ensure_ascii=False), input_file_path=directory / "input.yaml",
            output_folder=directory, typst_path=directory / "resume.typ",
            pdf_path=directory / "resume.pdf", dont_generate_png=True,
            dont_generate_html=True, dont_generate_markdown=True,
        )
        from app.services.resume_render_safety import install_safe_template_adapters
        install_safe_template_adapters(model.cv.name, model.settings.bold_keywords)
        # PyPI 2.8 bundles RenderCV but not FontAwesome. Supply its pinned MIT package.
        package_root = directory / "packages"
        rendercv_package = Path(pdf_png.__file__).parent / "rendercv_typst"
        package_version = tomllib.loads((rendercv_package / "typst.toml").read_text(encoding="utf-8"))["package"]["version"]
        shutil.copytree(rendercv_package, package_root / "preview" / "rendercv" / package_version)
        bundled = Path(__file__).resolve().parents[1] / "data" / "resume" / "preview" / "fontawesome" / "0.6.0"
        shutil.copytree(bundled, package_root / "preview" / "fontawesome" / "0.6.0")
        # Keep ALL compiler packages inside the parent-owned directory. Even
        # forced worker termination is cleaned by TemporaryDirectory.
        pdf_png.get_package_path = lambda: package_root
        generate_pdf(model, generate_typst(model))
    except RenderCVUserValidationError as error:
        fields = []
        for issue in error.validation_errors[:5]:
            location = getattr(issue, "schema_location", None)
            if location:
                parts = list(location)
                if len(parts) > 2 and parts[:2] == ["cv", "sections"]:
                    parts[2] = "[chapter]"
                fields.append("/".join(str(part) for part in parts)[:200])
        print(json.dumps({"fields": fields}))
        return 2
    except Exception:
        # Do not print/log exception strings: they may contain personal data.
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

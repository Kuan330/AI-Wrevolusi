"""Context-aware data escaping for the pinned engine's built-in templates only.

Installed inside an isolated render worker; never relaxes user Typst validation.
"""
import re


def typst_string(value):
    """Quote a data value, not code, inside a Typst string literal."""
    text = "" if value is None else str(value)
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")


def install_safe_template_adapters(plain_name, bold_keywords=()):
    from rendercv.renderer.templater import connections, model_processor, templater
    from rendercv.renderer.templater.string_processor import apply_string_processors

    original_environment = templater.get_jinja2_environment

    def environment(*args, **kwargs):
        env = original_environment(*args, **kwargs)
        if not getattr(env, "_aiw_safe_strings", False):
            # The engine inserts name/title/separator into quoted Preamble data.
            # Escape at that precise boundary, not the generated Typst program.
            env.filters["aiw_typst_string"] = lambda value: '"' + typst_string(value) + '"'
            original_source = env.loader.get_source

            def source(environment, template):
                text, filename, fresh = original_source(environment, template)
                if template.startswith("typst/"):
                    text = re.sub(r'"\{\{(.*?)\}\}"', lambda match: "{{ (" + match.group(1).strip() + ") | aiw_typst_string }}", text, flags=re.S)
                return text, filename, fresh

            env.loader.get_source = source
            env.cache.clear()
            env._aiw_safe_strings = True
        return env

    templater.get_jinja2_environment = environment

    original_connections = connections.parse_connections

    def parsed_connections(model):
        items = original_connections(model)
        for item in items:
            item.fontawesome_icon = typst_string(item.fontawesome_icon)
            if item.url is not None:
                item.url = typst_string(item.url)
        return items

    connections.parse_connections = parsed_connections

    original_footer = model_processor.render_footer_template
    expressions = ("#str(here().page())", "#str(counter(page).final().first())")
    def footer(template, **kwargs):
        # The pinned built-in footer starts with NAME and a separator. When
        # no name was supplied, leaving that whitespace inside *...* makes
        # Markdown treat the emphasis markers as literal characters. Remove
        # only this engine-owned absent-name prefix; never fabricate a name
        # or change the document/default-control metadata.
        if not plain_name and template == "*NAME -- PAGE_NUMBER/TOTAL_PAGES*":
            template = "*PAGE_NUMBER/TOTAL_PAGES*"
        processors = kwargs.get("string_processors") or []

        def process(text):
            # Reserve two private-use characters absent from both input and
            # keyword patterns. Unlike an ASCII token, even a one-letter bold
            # keyword cannot alter these markers. Full Markdown (e.g. emphasis
            # spanning both page counters) is processed without splitting it.
            used = set(text) | set("".join(bold_keywords))
            points = (point for start, end in ((0xF0000, 0xFFFFE), (0x100000, 0x10FFFE)) for point in range(start, end) if chr(point) not in used)
            markers = [chr(next(points)) for _ in expressions]
            for code, marker in zip(expressions, markers, strict=True):
                text = text.replace(code, marker)
            result = apply_string_processors(text, processors)
            for code, marker in zip(expressions, markers, strict=True):
                # Exactly these two engine-owned expressions are restored.
                result = result.replace(marker, code)
            return result

        # The normal header already processed its name. Use the original fact
        # here so punctuation/Markdown aren't escaped or formatted twice.
        return original_footer(template, **{**kwargs, "name": plain_name, "string_processors": [process]})

    model_processor.render_footer_template = footer

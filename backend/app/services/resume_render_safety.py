"""Context-aware data escaping for the pinned engine's built-in templates only.

Installed inside an isolated render worker; never relaxes user Typst validation.
"""
import re


def typst_string(value):
    """Quote a data value, not code, inside a Typst string literal."""
    text = "" if value is None else str(value)
    return text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")


def install_safe_template_adapters(plain_name, bold_keywords=(), *, contacts=None, contact_order=None):
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
    original_contact_markdown = connections.markdown_to_typst

    class LiteralContact(str):
        """Internal marker: header text must never be interpreted as markup."""

    def contact_markup(value):
        if isinstance(value, LiteralContact):
            return '#text("' + typst_string(value) + '")'
        return original_contact_markdown(value)

    connections.markdown_to_typst = contact_markup

    def parsed_connections(model):
        if contacts is None:
            items = original_connections(model)
        else:
            items = []
            original_order = model.cv._key_order
            try:
                # Preserve the user's header order, including interleaved
                # social/custom connections. Native values retain their engine
                # logic; only the three free-text fields use literal bodies.
                for key in contact_order or original_order:
                    if key in contacts:
                        value = contacts[key]
                        values = value if isinstance(value, list) else [value]
                        for text in values:
                            if isinstance(text, str) and text.strip():
                                items.append(connections.Connection(fontawesome_icon=connections.fontawesome_icons[key], url=None, body=LiteralContact(text)))
                    elif key in original_order:
                        model.cv._key_order = [key]
                        items.extend(original_connections(model))
            finally:
                model.cv._key_order = original_order
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



def install_text_section_pagination(package_directory):
    """The pinned engine groups consecutive bullets into one content-area block.

    That block must follow section pagination, not regular-entry pagination;
    otherwise a long Skills list silently overflows a single physical page.
    Change only the trusted package copy owned by the isolated render worker.
    Structured projects still follow the user's regular-entry break setting.
    """
    library = package_directory / "lib.typ"
    text = library.read_text(encoding="utf-8")
    old = "breakable: entries-allow-page-break,\n    below: sections-space-between-text-based-entries"
    new = 'breakable: config.at("sections-allow-page-break"),\n    below: sections-space-between-text-based-entries'
    if text.count(old) != 1:
        raise RuntimeError("Pinned text-section pagination adapter needs review.")
    library.write_text(text.replace(old, new, 1), encoding="utf-8")

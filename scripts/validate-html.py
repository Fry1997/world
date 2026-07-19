from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

root = Path.cwd()
errors: list[str] = []


class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.references: list[str] = []
        self.base_href: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "base" and values.get("href"):
            self.base_href = values["href"]
        for key in ("src", "href"):
            if values.get(key):
                self.references.append(values[key])


def resolve_reference(html_file: Path, base_href: str | None, reference: str) -> Path | None:
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc or reference.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None

    path = parsed.path
    if not path:
        return html_file

    if path.startswith("/world/"):
        target = root / path.removeprefix("/world/")
    elif path.startswith("/"):
        target = root / path.lstrip("/")
    elif base_href and base_href.startswith("/world/"):
        target = root / base_href.removeprefix("/world/") / path
    else:
        target = html_file.parent / path

    target = target.resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return target

    if path.endswith("/") or target.is_dir():
        target = target / "index.html"
    return target


for html_file in root.rglob("*.html"):
    if ".git" in html_file.parts or "dist" in html_file.parts or "node_modules" in html_file.parts:
        continue

    parser = DocumentParser()
    parser.feed(html_file.read_text(encoding="utf-8"))

    seen: set[str] = set()
    duplicates = sorted({value for value in parser.ids if value in seen or seen.add(value)})
    if duplicates:
        errors.append(f"{html_file.relative_to(root)} has duplicate ids: {', '.join(duplicates)}")

    for reference in parser.references:
        target = resolve_reference(html_file, parser.base_href, reference)
        if target is not None and not target.exists():
            display_target = target.relative_to(root) if target.is_relative_to(root) else target
            errors.append(
                f"{html_file.relative_to(root)} references missing file {reference} "
                f"(resolved to {display_target})"
            )

if errors:
    print("\n".join(f"- {error}" for error in errors))
    raise SystemExit(1)

print("Static HTML validation passed.")

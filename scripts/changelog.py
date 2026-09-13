"""Validate change fragments and collect them into Unreleased for a release PR."""

import argparse
import hashlib
from pathlib import Path
import re
import sys
import tempfile

CATEGORIES = ("added", "changed", "deprecated", "removed", "fixed", "security")
NAME = re.compile(r"[1-9][0-9]*-[a-z0-9]+(?:-[a-z0-9]+)*\.(" + "|".join(CATEGORIES) + r")\.md")


def read_fragments(directory):
    fragments = []
    for path in sorted(directory.iterdir()):
        if path.name == "README.md":
            continue
        match = NAME.fullmatch(path.name)
        if not match or not path.is_file() or path.is_symlink():
            raise ValueError(f"Invalid fragment path: {path.name}")
        body = path.read_text(encoding="utf-8").strip()
        if not body.startswith("- ") or len(body[2:].strip()) == 0:
            raise ValueError(f"{path.name}: write one Markdown bullet describing the change")
        if any(line and not line.startswith("  ") for line in body.splitlines()[1:]):
            raise ValueError(f"{path.name}: continuation lines must be indented two spaces")
        if any(marker in body for marker in ("<<<<<<<", "=======", ">>>>>>>", "<!--")):
            raise ValueError(f"{path.name}: conflict markers and HTML comments are not allowed")
        # Relative URLs would change meaning when moved to the root changelog.
        for url in re.findall(r"\]\(([^)]+)\)", body):
            if not url.startswith(("https://", "http://")):
                raise ValueError(f"{path.name}: use absolute HTTP(S) links")
        if re.search(r"\]\[[^]]*\]", body):
            raise ValueError(f"{path.name}: use inline absolute links, not reference links")
        fragments.append((path, match[1], body))
    return fragments


def render(changelog, fragments):
    marker = "## [Unreleased]"
    if changelog.count(marker) != 1:
        raise ValueError("CHANGELOG.md must have exactly one ## [Unreleased] heading")
    start = changelog.index(marker) + len(marker)
    next_release = re.search(r"^## ", changelog[start:], re.MULTILINE)
    end = start + next_release.start() if next_release else len(changelog)
    unreleased = changelog[start:end]
    for category in CATEGORIES:
        entries = []
        for path, kind, body in fragments:
            digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
            prefix = f"<!-- fragment: {path.name} "
            token = f"{prefix}sha256={digest} -->"
            if prefix in changelog and token not in changelog:
                raise ValueError(
                    f"{path.name}: already collected with different or unknown content; "
                    "use a new fragment name or review the interrupted collection"
                )
            if kind == category and token not in changelog:
                entries.append(token + "\n" + body)
        if not entries:
            continue
        content = "\n\n".join(entries) + "\n\n"
        heading = f"### {category.title()}\n"
        if heading in unreleased:
            position = unreleased.index(heading) + len(heading)
            unreleased = unreleased[:position] + "\n" + content + unreleased[position:].lstrip("\n")
        else:
            unreleased = unreleased.rstrip() + "\n\n" + heading + "\n" + content
    return changelog[:start] + unreleased + changelog[end:]


def build(root, write=False):
    fragments = read_fragments(root / "changelog.d")
    changelog = root / "CHANGELOG.md"
    if changelog.is_symlink():
        raise ValueError("CHANGELOG.md must not be a symlink")
    original = changelog.read_text(encoding="utf-8")
    result = render(original, fragments)
    if write:
        # Write before consuming fragments. Markers make a retry idempotent
        # if the process stops between replacement and fragment cleanup.
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=root,
                                         prefix=".changelog-", delete=False) as output:
            output.write(result)
            temporary = Path(output.name)
        try:
            temporary.chmod(changelog.stat().st_mode & 0o777)
            temporary.replace(changelog)
        finally:
            temporary.unlink(missing_ok=True)
        for path, _, body in fragments:
            if path.read_text(encoding="utf-8").strip() != body:
                raise ValueError(f"{path.name}: changed during collection; leaving it for review")
            path.unlink()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check", "build"])
    parser.add_argument("--write", action="store_true", help="Write changelog and consume fragments")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.command == "check":
        if args.write:
            raise ValueError("--write is only supported by build")
        fragments = read_fragments(root / "changelog.d")
        render((root / "CHANGELOG.md").read_text(encoding="utf-8"), fragments)
        print(f"Validated {len(fragments)} changelog fragments")
    else:
        result = build(root, args.write)
        if not args.write:
            print(result, end="")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"Changelog error: {error}", file=sys.stderr)
        sys.exit(1)

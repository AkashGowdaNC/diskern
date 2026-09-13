# Change fragments

Feature PRs add one uniquely named fragment instead of editing the shared
root changelog. Use `<issue>-<topic>.<category>.md`, for example
`171-scan-progress.fixed.md`. Categories: `added`, `changed`, `deprecated`,
`removed`, `fixed`, `security`.

Write one user-facing Markdown bullet. Indent continuation lines by two
spaces. Use absolute HTTP(S) links because release preparation moves the
text into the root changelog. Do not add headings, HTML comments, or
reference links. A documentation-only change need not add a fragment.

From the repository root:

```sh
python3 scripts/changelog.py check
python3 scripts/changelog.py build         # preview; changes no files
python3 scripts/changelog.py build --write # release preparation only
```

The release command adds fragments to `Unreleased`, preserves existing
entries and released history, and consumes the collected fragment files.
Commit the generated changelog and deletions together in the release PR.
Generated HTML markers prevent duplicate entries if cleanup is interrupted.
Keep those markers when moving Unreleased into a dated release section.

See [the release procedure](../docs/RELEASING.md).

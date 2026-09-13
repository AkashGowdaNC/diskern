from pathlib import Path
import tempfile
import unittest

from scripts.changelog import build, read_fragments, render

HISTORY = "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Existing fix\n\n## [1.0.0] — 2026-01-01\n\n- Old release\n"


class ChangelogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "changelog.d").mkdir()
        (self.root / "CHANGELOG.md").write_text(HISTORY)

    def fragment(self, name, body="- A change\n"):
        (self.root / "changelog.d" / name).write_text(body)

    def test_deterministic_collection_preserves_released_history(self):
        self.fragment("2-z.fixed.md", "- Second\n")
        self.fragment("1-a.fixed.md", "- First\n  with details\n")
        self.fragment("3-feature.added.md")
        result = build(self.root)
        self.assertLess(result.index("- First"), result.index("- Second"))
        self.assertIn("- Existing fix", result)
        self.assertTrue(result.endswith(HISTORY[HISTORY.index("## [1.0.0]"):]))
        self.assertEqual((self.root / "CHANGELOG.md").read_text(), HISTORY)
        self.assertEqual(result, build(self.root))

    def test_write_consumes_fragments_and_is_idempotent(self):
        self.fragment("1-a.fixed.md")
        first = build(self.root, True)
        self.assertEqual(list((self.root / "changelog.d").iterdir()), [])
        self.assertEqual(build(self.root, True), first)

    def test_retry_after_write_before_cleanup_does_not_duplicate(self):
        self.fragment("1-a.fixed.md")
        first = build(self.root)
        (self.root / "CHANGELOG.md").write_text(first)
        self.assertEqual(build(self.root, True), first)

    def test_reused_fragment_name_cannot_discard_different_release_notes(self):
        self.fragment("1-a.fixed.md", "- Original note\n")
        collected = build(self.root, True)
        self.fragment("1-a.fixed.md", "- A different change with a reused name\n")
        with self.assertRaisesRegex(ValueError, "already collected"):
            build(self.root, True)
        self.assertEqual((self.root / "CHANGELOG.md").read_text(), collected)
        self.assertIn("different change", (self.root / "changelog.d/1-a.fixed.md").read_text())

    def test_edited_fragment_after_interruption_is_preserved_for_review(self):
        self.fragment("1-a.fixed.md", "- Original note\n")
        (self.root / "CHANGELOG.md").write_text(build(self.root))
        self.fragment("1-a.fixed.md", "- Revised note\n")
        with self.assertRaises(ValueError):
            build(self.root, True)
        self.assertTrue((self.root / "changelog.d/1-a.fixed.md").exists())

    def test_invalid_fragment_does_not_mutate_history(self):
        for name, body in [("oops.md", "- Text"), ("1-a.fixed.md", ""),
                           ("1-a.fixed.md", "- Text\n<<<<<<< conflict"),
                           ("1-a.fixed.md", "- [docs](../docs/README.md)"),
                           ("1-a.fixed.md", "- One\n- Two")]:
            with self.subTest(name=name, body=body):
                path = self.root / "changelog.d" / name
                path.write_text(body)
                with self.assertRaises(ValueError):
                    build(self.root, True)
                self.assertEqual((self.root / "CHANGELOG.md").read_text(), HISTORY)
                path.unlink()

    def test_missing_unreleased_heading_is_rejected(self):
        with self.assertRaises(ValueError):
            render("# Changelog", [])

    def test_fragment_symlinks_are_rejected(self):
        link = self.root / "changelog.d/1-linked.fixed.md"
        link.symlink_to(self.root / "CHANGELOG.md")
        with self.assertRaises(ValueError):
            read_fragments(link.parent)


if __name__ == "__main__":
    unittest.main()

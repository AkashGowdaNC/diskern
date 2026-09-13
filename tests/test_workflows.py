import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import yaml

from scripts.ci_gate import REQUIRED_JOBS

ROOT = Path(__file__).resolve().parents[1]


def workflow(name):
    # BaseLoader preserves YAML's `on` key instead of treating it as a boolean.
    return yaml.load((ROOT / ".github/workflows" / name).read_text(), Loader=yaml.BaseLoader)


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.ci = workflow("ci.yml")
        self.jobs = self.ci["jobs"]

    def test_gate_depends_on_every_job_and_cannot_skip_after_failure(self):
        gate = self.jobs["ready-to-merge"]
        self.assertEqual(set(gate["needs"]), set(self.jobs) - {"ready-to-merge"})
        self.assertEqual(set(gate["needs"]), set(REQUIRED_JOBS))
        self.assertEqual(gate["if"], "${{ always() }}")
        self.assertEqual(gate["steps"][-1]["env"]["CI_NEEDS"], "${{ toJSON(needs) }}")
        self.assertEqual(gate["steps"][-1]["run"], "python3 scripts/ci_gate.py")
        for job in self.jobs.values():
            self.assertNotIn("continue-on-error", job)
            for step in job.get("steps", []):
                self.assertNotIn("continue-on-error", step)

    def test_queue_event_tests_its_supplied_commit_without_cross_cancellation(self):
        self.assertEqual(self.ci["on"]["merge_group"]["types"], ["checks_requested"])
        self.assertNotIn("pull_request_target", self.ci["on"])
        group = self.ci["concurrency"]["group"]
        for value in ["github.workflow", "github.event_name", "github.ref"]:
            self.assertIn(value, group)
        self.assertEqual(self.ci["concurrency"]["cancel-in-progress"], "${{ github.event_name == 'pull_request' }}")
        for job in self.jobs.values():
            for step in job.get("steps", []):
                if step.get("uses", "").startswith("actions/checkout@"):
                    self.assertNotIn("ref", step.get("with", {}))

    def test_scope_script_forces_full_push_and_queue_builds_and_rejects_bad_filters(self):
        changes = self.jobs["changes"]
        filtering = next(s for s in changes["steps"] if s.get("id") == "filter")
        self.assertEqual(filtering["if"], "github.event_name == 'pull_request'")
        scope = next(s for s in changes["steps"] if s.get("id") == "scope")
        for event, value, expected in [("merge_group", "", "true"), ("push", "false", "true"),
                                        ("pull_request", "false", "false"), ("pull_request", "true", "true"),
                                        ("pull_request", "", None), ("pull_request", "unknown", None)]:
            with self.subTest(event=event, value=value), tempfile.NamedTemporaryFile() as output:
                env = dict(os.environ, CI_EVENT=event, FILTER_APP=value, GITHUB_OUTPUT=output.name)
                run = subprocess.run(["bash", "-e", "-c", scope["run"]], env=env, capture_output=True)
                if expected is None:
                    self.assertNotEqual(run.returncode, 0)
                else:
                    self.assertEqual(run.returncode, 0, run.stderr)
                    self.assertEqual(Path(output.name).read_text().strip(), f"app={expected}")
        self.assertEqual(self.jobs["app-tauri"]["if"], "needs.changes.outputs.app == 'true'")

    def test_all_platforms_remain_covered(self):
        for name in ["test", "app-tauri"]:
            self.assertEqual(set(self.jobs[name]["strategy"]["matrix"]["os"]),
                             {"ubuntu-22.04", "windows-latest", "macos-latest"})
            self.assertEqual(self.jobs[name]["strategy"]["fail-fast"], "false")

    def test_validation_does_not_publish_or_release_queue_commits(self):
        for name in ["deploy-pages.yml", "release.yml"]:
            self.assertNotIn("merge_group", workflow(name)["on"])
        self.assertEqual(self.ci["permissions"], {"contents": "read"})


if __name__ == "__main__":
    unittest.main()

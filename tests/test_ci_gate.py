import os
from pathlib import Path
import subprocess
import sys
import unittest

from scripts.ci_gate import REQUIRED_JOBS, failures


def results(app="true"):
    needs = {name: {"result": "success"} for name in REQUIRED_JOBS}
    needs["changes"]["outputs"] = {"app": app}
    return needs


class GateTests(unittest.TestCase):
    def test_full_success_for_each_supported_event(self):
        for event in ["pull_request", "merge_group", "push"]:
            self.assertEqual(failures(results(), event), [])

    def test_each_failed_cancelled_missing_or_skipped_job_blocks_queue(self):
        for name in REQUIRED_JOBS:
            for outcome in ["failure", "cancelled", "skipped", "", None]:
                with self.subTest(name=name, outcome=outcome):
                    needs = results()
                    needs[name]["result"] = outcome
                    self.assertTrue(failures(needs, "merge_group"))
            needs = results()
            del needs[name]
            self.assertTrue(failures(needs, "merge_group"))

    def test_only_confirmed_documentation_pr_may_skip_tauri(self):
        needs = results("false")
        needs["app-tauri"]["result"] = "skipped"
        self.assertEqual(failures(needs, "pull_request"), [])
        for event in ["push", "merge_group"]:
            self.assertTrue(failures(needs, event))
        needs["changes"]["result"] = "failure"
        self.assertTrue(failures(needs, "pull_request"))

    def test_unknown_outputs_and_jobs_do_not_pass(self):
        for app in [None, "", "False", False]:
            self.assertTrue(failures(results(app), "pull_request"))
        needs = results()
        needs["new-job"] = {"result": "success"}
        self.assertTrue(failures(needs, "pull_request"))
        self.assertTrue(failures(results(), "workflow_dispatch"))

    def test_malformed_inputs_exit_nonzero(self):
        script = Path(__file__).resolve().parents[1] / "scripts/ci_gate.py"
        for raw in ["not-json", "[]", '{"changes": null}', '{}']:
            env = dict(os.environ, CI_NEEDS=raw, CI_EVENT="merge_group")
            proc = subprocess.run([sys.executable, script], env=env, capture_output=True)
            self.assertEqual(proc.returncode, 1)


if __name__ == "__main__":
    unittest.main()

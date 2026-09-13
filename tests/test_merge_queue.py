import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.merge_queue import desired_policy, main, queue_recovery, successful_gate


def gate(outcome="success", check_id=1, sha="abc"):
    return {"id": check_id, "name": "ready-to-merge", "head_sha": sha,
            "status": "completed", "conclusion": outcome,
            "app": {"slug": "github-actions", "id": 123}, "check_suite": {"id": 456}}


class QueuePolicyTests(unittest.TestCase):
    def test_policy_requires_queue_review_and_ci_without_bypass(self):
        policy = desired_policy(123)
        self.assertEqual(policy["conditions"]["ref_name"], {"include": ["refs/heads/main"], "exclude": []})
        self.assertEqual(policy["bypass_actors"], [])
        rules = {r["type"]: r.get("parameters") for r in policy["rules"]}
        self.assertTrue({"pull_request", "merge_queue", "deletion", "non_fast_forward", "required_status_checks"} <= rules.keys())
        self.assertNotIn("update", rules, "An update restriction would also block the queue")
        self.assertTrue(rules["pull_request"]["require_last_push_approval"])
        self.assertTrue(rules["pull_request"]["dismiss_stale_reviews_on_push"])
        self.assertGreaterEqual(rules["pull_request"]["required_approving_review_count"], 1)
        self.assertEqual(rules["merge_queue"]["grouping_strategy"], "ALLGREEN")
        self.assertEqual(rules["required_status_checks"]["required_status_checks"],
                         [{"context": "ready-to-merge", "integration_id": 123}])
        self.assertFalse(rules["required_status_checks"]["strict_required_status_checks_policy"])

    def test_recovery_preserves_all_other_protections_and_requires_fresh_ci(self):
        original = desired_policy(123)
        before = copy.deepcopy(original)
        recovered = queue_recovery(original)
        self.assertEqual(original, before)
        self.assertEqual(recovered["bypass_actors"], [])
        self.assertEqual(recovered["enforcement"], "active")
        rules = {r["type"]: r for r in recovered["rules"]}
        self.assertNotIn("merge_queue", rules)
        for rule in original["rules"]:
            if rule["type"] not in {"merge_queue", "required_status_checks"}:
                self.assertEqual(rules[rule["type"]], rule)
        self.assertTrue(rules["required_status_checks"]["parameters"]["strict_required_status_checks_policy"])

    def test_only_latest_success_from_correct_commit_and_app_is_accepted(self):
        self.assertEqual(successful_gate([gate()], "abc")["id"], 1)
        for checks in [[], [gate(sha="old")], [gate(), gate("failure", 2)],
                       [dict(gate(), app={"slug": "another-app"})],
                       [dict(gate(), status="in_progress")]]:
            with self.subTest(checks=checks), self.assertRaises(ValueError):
                successful_gate(checks, "abc")

    def test_apply_refuses_unvalidated_main_before_backup_or_write(self):
        calls = []
        def fake_api(repo, path="", method="GET", data=None):
            calls.append((path, method))
            if path == "/rulesets?per_page=100": return []
            if path == "": return {"permissions": {"admin": True}, "default_branch": "main", "allow_merge_commit": True}
            if path == "/git/ref/heads/main": return {"object": {"sha": "abc"}}
            if "check-runs" in path: return {"check_runs": []}
            self.fail(f"Unexpected API call {path}")
        with tempfile.TemporaryDirectory() as directory:
            backup = Path(directory) / "backup.json"
            with patch("scripts.merge_queue.api", side_effect=fake_api), patch("sys.argv", ["merge_queue.py", "apply", "--backup", str(backup)]):
                with self.assertRaises(ValueError): main()
            self.assertFalse(backup.exists())
        self.assertTrue(all(method == "GET" for _, method in calls))

    def apply_fixture(self, backup, *, changed=False, workflow=".github/workflows/ci.yml"):
        calls = []
        reads = 0
        def fake_api(repo, path="", method="GET", data=None):
            nonlocal reads
            calls.append((path, method, data))
            if method == "POST":
                self.assertTrue(backup.exists(), "Back up before mutation")
                return {"id": 99, "enforcement": "active"}
            if path == "/rulesets?per_page=100": return [{"name": "Unrelated policy", "id": 1}]
            if path == "": return {"permissions": {"admin": True}, "default_branch": "main", "allow_merge_commit": True}
            if path == "/git/ref/heads/main":
                reads += 1
                return {"object": {"sha": "new" if changed and reads > 1 else "abc"}}
            if "check-runs" in path: return {"check_runs": [gate()]}
            if "actions/runs" in path:
                return {"workflow_runs": [{"path": workflow, "head_sha": "abc", "event": "push", "conclusion": "success"}]}
            self.fail(f"Unexpected API call {path}")
        return fake_api, calls

    def test_apply_uses_observed_actions_app_and_only_creates_its_own_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            backup = Path(directory) / "backup.json"
            api, calls = self.apply_fixture(backup)
            with patch("scripts.merge_queue.api", side_effect=api), patch("sys.argv", ["merge_queue.py", "apply", "--backup", str(backup)]), patch("builtins.print"):
                main()
            self.assertIsNone(json.loads(backup.read_text()))
        writes = [(path, method, body) for path, method, body in calls if method != "GET"]
        self.assertEqual(writes, [("/rulesets", "POST", desired_policy(123))])

    def test_moving_main_or_wrong_workflow_cannot_activate(self):
        for options in [{"changed": True}, {"workflow": ".github/workflows/unrelated.yml"}]:
            with self.subTest(options=options), tempfile.TemporaryDirectory() as directory:
                backup = Path(directory) / "backup.json"
                api, calls = self.apply_fixture(backup, **options)
                with patch("scripts.merge_queue.api", side_effect=api), patch("sys.argv", ["merge_queue.py", "apply", "--backup", str(backup)]):
                    with self.assertRaises(ValueError): main()
                self.assertFalse(backup.exists())
                self.assertTrue(all(method == "GET" for _, method, _ in calls))

    def test_existing_backup_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            backup = Path(directory) / "backup.json"
            backup.write_text("previous backup")
            api, calls = self.apply_fixture(backup)
            with patch("scripts.merge_queue.api", side_effect=api), patch("sys.argv", ["merge_queue.py", "apply", "--backup", str(backup)]):
                with self.assertRaises(FileExistsError): main()
            self.assertEqual(backup.read_text(), "previous backup")
            self.assertTrue(all(method == "GET" for _, method, _ in calls))


if __name__ == "__main__":
    unittest.main()

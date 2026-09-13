import copy
import base64
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.merge_queue import (desired_policy, main, queue_recovery, successful_gate,
                                 validate_existing_policy, verify_reviewed_policy)


def gate(outcome="success", check_id=1, sha="abc"):
    return {"id": check_id, "name": "ready-to-merge", "head_sha": sha,
            "status": "completed", "conclusion": outcome,
            "app": {"slug": "github-actions", "id": 123}, "check_suite": {"id": 456}}


class QueuePolicyTests(unittest.TestCase):
    def test_apply_does_not_silently_remove_stricter_or_additional_protection(self):
        desired = desired_policy(123)
        changed = copy.deepcopy(desired)
        changed["rules"].append({"type": "required_signatures"})
        with self.assertRaisesRegex(ValueError, "differs"):
            validate_existing_policy(changed, desired)
        changed = copy.deepcopy(desired)
        next(r for r in changed["rules"] if r["type"] == "pull_request")["parameters"]["required_approving_review_count"] = 2
        with self.assertRaises(ValueError):
            validate_existing_policy(changed, desired)
        validate_existing_policy(changed, desired, replace=True)

    def test_unchanged_and_recovery_policies_can_be_reapplied(self):
        desired = desired_policy(123)
        unchanged = copy.deepcopy(desired)
        unchanged["rules"].reverse()
        unchanged["id"] = 99
        validate_existing_policy(unchanged, desired)
        validate_existing_policy(queue_recovery(desired), desired)

    def test_replacement_never_broadens_recovery_to_an_unexpected_scope(self):
        policy = desired_policy(123)
        changed = copy.deepcopy(policy)
        changed["conditions"]["ref_name"]["include"] = ["refs/heads/*"]
        with self.assertRaisesRegex(ValueError, "exactly main"):
            validate_existing_policy(changed, policy, replace=True)

    def test_only_policy_from_validated_main_can_be_installed(self):
        policy = desired_policy()
        content = {"content": base64.b64encode(json.dumps(policy).encode()).decode()}
        verify_reviewed_policy(content, policy)
        unreviewed = copy.deepcopy(policy)
        unreviewed["bypass_actors"] = [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]
        with self.assertRaisesRegex(ValueError, "Local policy differs"):
            verify_reviewed_policy(content, unreviewed)

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

    def apply_fixture(self, backup, *, changed=False, workflow=".github/workflows/ci.yml", current=None):
        calls = []
        reads = 0
        def fake_api(repo, path="", method="GET", data=None):
            nonlocal reads
            calls.append((path, method, data))
            if method in {"POST", "PUT"}:
                self.assertTrue(backup.exists(), "Back up before mutation")
                return {"id": 99, "enforcement": "active"}
            if path == "/rulesets?per_page=100":
                return [{"name": "Unrelated policy", "id": 1}] + ([{"name": current["name"], "id": 99}] if current else [])
            if path == "/rulesets/99": return current
            if path == "": return {"permissions": {"admin": True}, "default_branch": "main", "allow_merge_commit": True}
            if path == "/git/ref/heads/main":
                reads += 1
                return {"object": {"sha": "new" if changed and reads > 1 else "abc"}}
            if "check-runs" in path: return {"check_runs": [gate()]}
            if "actions/runs" in path:
                return {"workflow_runs": [{"path": workflow, "head_sha": "abc", "event": "push", "conclusion": "success"}]}
            if path == "/contents/.github/rulesets/main.json?ref=abc":
                return {"content": base64.b64encode(json.dumps(desired_policy()).encode()).decode()}
            self.fail(f"Unexpected API call {path}")
        return fake_api, calls

    def test_custom_policy_requires_explicit_replacement_before_any_write(self):
        current = desired_policy(123)
        current["id"] = 99
        current["rules"].append({"type": "required_signatures"})
        for replace in [False, True]:
            with self.subTest(replace=replace), tempfile.TemporaryDirectory() as directory:
                backup = Path(directory) / "backup.json"
                api, calls = self.apply_fixture(backup, current=current)
                args = ["merge_queue.py", "apply", "--backup", str(backup)]
                if replace: args.append("--replace-policy")
                with patch("scripts.merge_queue.api", side_effect=api), patch("sys.argv", args), patch("builtins.print"):
                    if replace:
                        main()
                    else:
                        with self.assertRaisesRegex(ValueError, "differs"): main()
                writes = [(path, method) for path, method, _ in calls if method != "GET"]
                self.assertEqual(writes, [("/rulesets/99", "PUT")] if replace else [])
                self.assertEqual(backup.exists(), replace)
                if replace: self.assertEqual(json.loads(backup.read_text()), current)

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

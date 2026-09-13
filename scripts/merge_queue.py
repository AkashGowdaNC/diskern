"""Preview/install the reviewed ruleset after CI lands; uses existing gh auth."""

import argparse
import base64
import copy
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
WRITABLE_FIELDS = ("name", "target", "enforcement", "bypass_actors", "conditions", "rules")


def canonical(value):
    """Ignore API ordering, without ignoring changed settings or extra rules."""
    if isinstance(value, dict):
        return {key: canonical(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return sorted((canonical(item) for item in value), key=lambda item: json.dumps(item, sort_keys=True))
    return value


def validate_existing_policy(current, target, replace=False):
    if current is None:
        return
    if current.get("target") != "branch" or current.get("conditions") != target["conditions"]:
        raise ValueError("The named ruleset no longer targets exactly main; inspect it manually")
    observed = {key: current[key] for key in WRITABLE_FIELDS if key in current}
    if not replace and canonical(observed) not in [canonical(target), canonical(queue_recovery(target))]:
        raise ValueError(
            "The installed policy differs from the reviewed policy; inspect plan/status "
            "and use --replace-policy only after reviewing the differences"
        )


def verify_reviewed_policy(content, policy):
    remote = json.loads(base64.b64decode(content["content"]).decode("utf-8"))
    if canonical(remote) != canonical(policy):
        raise ValueError("Local policy differs from CI-validated main; use its reviewed policy")


def api(repo, path="", method="GET", data=None):
    command = ["gh", "api", f"repos/{repo}{path}", "--method", method]
    if data is not None:
        command.extend(["--input", "-"])
    result = subprocess.run(command, input=json.dumps(data) if data is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout) if result.stdout.strip() else None


def desired_policy(app_id=None):
    policy = json.loads((ROOT / ".github/rulesets/main.json").read_text())
    if app_id is not None:
        for rule in policy["rules"]:
            if rule["type"] == "required_status_checks":
                for check in rule["parameters"]["required_status_checks"]:
                    check["integration_id"] = app_id
    return policy


def queue_recovery(policy):
    """Keep review/check protections while allowing a reviewed queue repair."""
    recovered = {key: copy.deepcopy(policy[key]) for key in WRITABLE_FIELDS if key in policy}
    recovered["rules"] = [r for r in recovered["rules"] if r["type"] != "merge_queue"]
    for rule in recovered["rules"]:
        if rule["type"] == "required_status_checks":
            rule["parameters"]["strict_required_status_checks_policy"] = True
    return recovered


def successful_gate(checks, sha):
    candidates = [c for c in checks if c.get("name") == "ready-to-merge"
                  and c.get("head_sha") == sha and c.get("app", {}).get("slug") == "github-actions"]
    # Never accept an older success after a failed or pending rerun.
    if not candidates:
        raise ValueError("main has no ready-to-merge check from GitHub Actions")
    latest = max(candidates, key=lambda c: c["id"])
    if latest.get("status") != "completed" or latest.get("conclusion") != "success":
        raise ValueError("The latest ready-to-merge check on main has not passed")
    return latest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["plan", "status", "apply", "recover"])
    parser.add_argument("--repo", default="Coding-Moves/diskern")
    parser.add_argument("--backup", type=Path, help="Required, new backup file for mutations")
    parser.add_argument("--replace-policy", action="store_true",
                        help="Apply only: explicitly replace a changed managed policy after reviewing it")
    args = parser.parse_args()
    policy = desired_policy()
    if args.replace_policy and args.command != "apply":
        raise ValueError("--replace-policy is only supported by apply")
    if args.command == "plan":
        print(json.dumps(policy, indent=2))
        return
    existing = [r for r in api(args.repo, "/rulesets?per_page=100") if r["name"] == policy["name"]]
    if len(existing) > 1:
        raise ValueError("Multiple matching rulesets: inspect repository settings manually")
    current = api(args.repo, f"/rulesets/{existing[0]['id']}") if existing else None
    if args.command == "status":
        print(json.dumps(current, indent=2))
        return
    if not args.backup:
        raise ValueError("Provide --backup with a new file path before changing settings")
    repo = api(args.repo)
    if not repo.get("permissions", {}).get("admin"):
        raise ValueError("Repository administration permission is required")
    if args.command == "recover":
        if current is None:
            raise ValueError("The managed ruleset does not exist")
        validate_existing_policy(current, policy, replace=True)
        target = queue_recovery(current)
    else:
        if repo.get("default_branch") != "main":
            raise ValueError("This policy requires main as the default branch")
        if not repo.get("allow_merge_commit"):
            raise ValueError("Enable merge commits or explicitly review the policy's merge method")
        sha = api(args.repo, "/git/ref/heads/main")["object"]["sha"]
        checks = api(args.repo, f"/commits/{sha}/check-runs?per_page=100")["check_runs"]
        check = successful_gate(checks, sha)
        # Verify the check belongs to our CI workflow on main, not a PR or a
        # different workflow that happens to reuse the same job name.
        suite = check["check_suite"]["id"]
        runs = api(args.repo, f"/actions/runs?check_suite_id={suite}&per_page=100")["workflow_runs"]
        if not any(r.get("head_sha") == sha and r.get("event") == "push"
                   and r.get("path") == ".github/workflows/ci.yml"
                   and r.get("conclusion") == "success" for r in runs):
            raise ValueError("Wait for the complete CI push run on main to pass")
        content = api(args.repo, f"/contents/.github/rulesets/main.json?ref={sha}")
        verify_reviewed_policy(content, policy)
        target = desired_policy(check["app"]["id"])
        validate_existing_policy(current, target, replace=args.replace_policy)
        if api(args.repo, "/git/ref/heads/main")["object"]["sha"] != sha:
            raise ValueError("main changed during preflight; rerun after its CI passes")
    # No settings are changed until all preconditions have passed. Never
    # overwrite a backup, or touch the repository's unrelated rulesets.
    with args.backup.open("x") as backup:
        json.dump(current, backup, indent=2)
        backup.write("\n")
    if current:
        result = api(args.repo, f"/rulesets/{current['id']}", "PUT", target)
    else:
        result = api(args.repo, "/rulesets", "POST", target)
    print(json.dumps({"id": result["id"], "enforcement": result["enforcement"],
                      "backup": str(args.backup)}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"Merge queue configuration failed: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        sys.exit(1)

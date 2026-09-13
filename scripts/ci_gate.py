"""Evaluate the complete CI dependency graph; absent results never mean success."""

import json
import os
import sys

REQUIRED_JOBS = (
    "changes", "lint", "test", "typos", "doc-links", "site",
    "app-frontend", "repository", "app-tauri",
)


def failures(needs, event):
    if not isinstance(needs, dict):
        return ["CI results must be an object"]
    problems = []
    if event not in {"pull_request", "merge_group", "push"}:
        problems.append(f"Unsupported CI event: {event}")
    if set(needs) != set(REQUIRED_JOBS):
        problems.append("CI dependency list is missing jobs or contains unknown jobs")
    changes = needs.get("changes", {})
    app = changes.get("outputs", {}).get("app")
    if app not in {"true", "false"}:
        problems.append("Change detection did not report true or false")
    if event != "pull_request" and app != "true":
        problems.append("Push and merge-group builds must run the full suite")
    for name in REQUIRED_JOBS:
        result = needs.get(name, {}).get("result")
        skip_allowed = (
            name == "app-tauri" and event == "pull_request"
            and changes.get("result") == "success" and app == "false"
        )
        if result != "success" and not (result == "skipped" and skip_allowed):
            problems.append(f"{name}: {result or 'missing'}")
    return problems


def main():
    try:
        problems = failures(json.loads(os.environ["CI_NEEDS"]), os.environ["CI_EVENT"])
    except (KeyError, ValueError, TypeError, AttributeError) as error:
        problems = [f"Invalid CI gate input: {error}"]
    if problems:
        print("CI gate rejected this commit:\n" + "\n".join(problems), file=sys.stderr)
        return 1
    print("All required CI jobs passed for this commit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

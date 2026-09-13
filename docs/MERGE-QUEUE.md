# Merging concurrent PRs

An individual green PR does not prove it works with another green PR.
The merge queue validates current `main` plus the changes ahead of a PR
before integration. Maintainers can queue several approved PRs without
manually refreshing every compatible branch. Conflicting edits still need
an intentional resolution; passing tests cover only the behavior exercised.

## CI contract

[CI](../.github/workflows/ci.yml) runs on `pull_request`, `merge_group`
(`checks_requested`), and pushes to `main`. Checkout uses the event's
commit; it never substitutes a contributor's head for the integration commit.
Pushes and merge groups always run the full suite. A PR may skip the Tauri
matrix only when successful change detection explicitly reports no app,
engine, or CI/tooling changes. Other validation always runs.

The required GitHub check context is **`ready-to-merge`**. The UI may display
it beneath the workflow name **CI**; do not configure the context as
`CI / ready-to-merge`. The setup tool discovers and pins its GitHub Actions
app ID. This final job runs even when dependencies fail, and rejects failed,
cancelled, missing, unknown, and unexpectedly skipped results. Matrix jobs
have fail-fast disabled and no continue-on-error exemptions. Workflow tests
ensure every CI job is included in the gate.

Concurrency keys include workflow, event, and ref. A PR update cancels only
that PR's previous build; queue groups do not cancel each other. Deployments
and signed releases do not run on merge-group events.

## Activate after this implementation is merged

The JSON policy is a proposed configuration until installed. Merely merging
the files does **not** enable protection. Enabling a required check before
its workflow exists would block the repository. Perform these steps with a
repository administrator account after the PR lands:

```sh
git switch main
git pull --ff-only origin main
gh auth status
python3 scripts/merge_queue.py plan
python3 scripts/merge_queue.py status
# Wait for the complete CI push run on this main commit to finish green.
python3 scripts/merge_queue.py apply --backup /tmp/diskern-rules-before-queue.json
python3 scripts/merge_queue.py status
```

Use a new backup path on subsequent applications. Keep backups outside the
checkout. `apply` verifies admin access, a successful latest gate from our
CI push workflow on current `main`, and an unchanged main ref during preflight.
It creates or updates only **Diskern main merge queue**, saves the previous
policy before changing it, and leaves unrelated rulesets alone. The local
JSON must match the policy on that CI-validated main commit. If the managed
policy has since been customized (for example, two approvals or signed
commits were required), default `apply` refuses to replace it. Compare
`plan` and `status`; use `apply --replace-policy --backup NEW_PATH` only
after reviewing and deliberately accepting that replacement. Normal
reapplication of an unchanged policy or the tool's recovery policy needs
no replacement flag. A ruleset with an unexpected branch scope always needs
manual inspection, including during recovery. Its default
repository is `Coding-Moves/diskern`; use `--repo OWNER/REPO` for a rehearsal.
Existing classic protection or organization rules continue to apply and
should be inspected for incompatible required contexts before activation.

[The policy](../.github/rulesets/main.json) requires PRs, one approval,
resolved review conversations, renewed approval after reviewable pushes,
the final CI gate, and the queue. It blocks deletion and force pushes with
no routine bypass actors. It uses merge commits to preserve current history.
It deliberately omits an `update` restriction, which would block the queue
as well as direct pushes. PR and queue requirements control integration.

The reviewer must be someone other than the latest pusher. If an agent
pushes using your account, you are the pusher: another person must approve.
Have a second eligible reviewer available before activating the policy.

Initial tuning: two concurrent candidate builds, batches of one to three,
all candidates green, and a 60-minute check timeout. This leaves room above
the recently observed few-minute warm builds for cold platform builds.
Measure actual queue/build time before increasing concurrency; each candidate
runs both three-platform matrices. Minimum batch size one avoids waiting
for another PR. The queue replaces strict “branch must be up to date” checking
so authors do not race to update branches unnecessarily.

## Daily flow

1. Open a small PR from current main; keep independent work in separate files.
2. Wait for CI and a reviewer who did not make the latest push.
3. Choose **Merge when ready / Add to merge queue**, as shown by GitHub, or
   use `gh pr merge NUMBER --auto` on this queue-protected branch.
4. The queue validates combined changes. Check its PR timeline if a candidate
   is removed. Repair that PR, rerun checks, get fresh approval, and requeue.

Do not force merge, pick “ours/theirs” across conflicts, or delete tests to
make integration pass. Review a conflict resolution as code: it can change
behavior even when its intent was only to combine branches. Coordinate changes
to the same component, stack dependent PRs, and separate broad formatting
changes from features. Squash/rebase is a history choice, not conflict prevention.

Dependency-update PRs use the same gate and queue. With `GITHUB_TOKEN`, a
maintainer may need to select **Approve workflows to run**. Auto-fix's local
checks do not substitute for PR CI. See [dependency automation](DEPENDENCY-AUTOMATION.md).

## Validation and rollout evidence

Local commands cover failure policy, workflow wiring, scope decisions,
configuration preflight/recovery, changelog integrity, and recursive test
discovery:

```sh
python3 -m pip install -r tests/requirements.txt
python3 -m unittest discover -s tests -v
node --test tests/*.test.mjs
(cd app && npm test && npm run build)
```

These tests are not proof that GitHub's live queue has been activated.
Record the following host-level acceptance results with PR and Actions links
after setup. Use an organization-owned public rehearsal repository (or an
eligible private repository) with this implementation on its default main
for destructive/failure examples. Do not run intentional failure examples
against Diskern's production main.

| Scenario | Procedure and expected result |
| --- | --- |
| Compatible PRs | Create two independent small PRs, approve and queue both. Verify merge-group runs and combined integration commits; both land without manually updating their branches. |
| Integration failure | Start with two numbers whose sum is at most 10. PR A raises the first from 1 to 6, PR B raises the second from 1 to 6. Assert the sum is at most 10 in a required test. Both pass alone; the second combined candidate fails and is removed. The target keeps only a valid candidate. |
| Text conflict | Two branches change the same line differently. After the first lands, the other is blocked or removed with an explanation. Resolve and requeue without discarding either intended behavior. |
| Documentation PR | Verify its Tauri jobs skip, its remaining jobs pass, and its gate succeeds. Once queued, confirm the full Tauri matrix executes. |
| Failed/cancelled job | Fail or cancel a required job. The final gate must not pass and the candidate must not merge. A pending/missing check must not be treated as green. |
| Fork PR | Open a PR from a contributor fork; approve workflows if requested. Confirm normal CI, independent review, and queue integration without extra token privileges. |
| Protection | In the rehearsal repository, attempt a normal direct push and a merge outside the queue; both must be rejected. Inspect the installed policy and confirm no bypass actors. |

Keep issue #170's operational checklist open until the installed settings and
live queue behavior have been verified, even if its implementation PR has
merged. CI success on a PR does not establish repository-admin state.

## Recovery

If only queue execution is misconfigured, remove the queue requirement while
retaining PR review and required CI, and turn strict up-to-date checking back on:

```sh
python3 scripts/merge_queue.py recover --backup /tmp/diskern-rules-before-recovery.json
```

Repair via a reviewed PR, merge with fresh passing CI, then reapply the queue
policy. If the required gate itself cannot run, an administrator must inspect
the failure and temporarily adjust that one context in repository settings;
the recovery tool intentionally does not waive CI. Record the intervention,
restore the required context as soon as it reports, and rerun the live checks.
Backups preserve the prior configuration; never disable every protection as
a convenience fallback. An administrator can edit rulesets, but ordinary
merges have no configured exemption.

References: [GitHub merge queues](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue),
[merge-group events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group),
[ruleset API](https://docs.github.com/en/rest/repos/rules).

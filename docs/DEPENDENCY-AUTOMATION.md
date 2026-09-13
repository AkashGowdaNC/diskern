# Dependency automation

Three pieces keep the Rust dependency tree honest. They overlap on
purpose: Dependabot moves versions forward, the audit workflow notices
when a version we are already on turns out to be vulnerable, and the
auto-fix workflow turns that finding into a PR.

| Piece | File | Cadence | Output |
| --- | --- | --- | --- |
| Audit | [audit.yml](../.github/workflows/audit.yml) | Mondays 06:00 UTC, every push to `main`/`master`, PRs touching `Cargo.lock` | A labelled tracking issue, or an inline PR annotation |
| Auto-fix | [auto-fix.yml](../.github/workflows/auto-fix.yml) | Mondays 07:00 UTC, and after a failed Audit run on `main`/`master` | A PR on `automation/cargo-update` |
| Dependabot | [dependabot.yml](../.github/dependabot.yml) | Weekly | One grouped PR for minor/patch, one PR per major |

## Audit

`cargo audit` reads `Cargo.lock` against the [RUSTSEC advisory
database](https://rustsec.org/) and reports two things: vulnerabilities,
and warnings (unmaintained, unsound, or yanked crates). The workflow
counts both.

On a pull request it runs `rustsec/audit-check`, which annotates the
advisory inline on the changed lockfile.

Everywhere else it owns a single issue titled **RUSTSEC advisories in
Cargo.lock**, labelled `security` and `automated-issue`:

- Advisories found, no open issue → files one listing every advisory id,
  the crate and version that pulled it in, and the advisory title.
- Advisories found, issue already open → rewrites the body in place.
  A four-month-old advisory stays one thread, not seventeen.
- Nothing found → closes the issue with a comment.

The job then fails, which is what auto-fix watches for.

Both labels are created by the workflow if the repository doesn't have
them yet, so this needs no manual setup.

## The ignore list

Some advisories cannot be fixed here. They arrive through `tauri`, and
clearing them needs a release Tauri has not made yet. Those are listed,
with a reason each, in [`.cargo/audit.toml`](../.cargo/audit.toml).

The whole list today is one dependency: Tauri v2 renders on Linux through
webkit2gtk-4.1, which links the **gtk-rs GTK3 bindings**. Those bindings
were archived upstream in 2024 — ten crates, plus `glib`'s unsound
`VariantStrIter` (fixed in the 0.19 line the GTK3 bindings never moved
to), plus `proc-macro-error` via `glib-macros`. The five `unic-*` crates
come the same way, via `urlpattern` in `tauri-utils`. Confirm any of it
with:

```
cargo tree -i gtk --target x86_64-unknown-linux-gnu
```

None of them is a *vulnerability*. `cargo audit` reports zero of those
against this lockfile; all seventeen are informational — sixteen
unmaintained, one unsound.

**Why ignore rather than leave them red.** The audit job fails while
advisories stand, and auto-fix opens a PR when a version clears one.
Neither has anywhere to go here: there is no newer version, so the audit
stays red forever and the auto-fix PR is empty every week. A check that
is always red stops being read, and then the eighteenth advisory — the
one that *is* a vulnerability, in a crate we chose — arrives into a run
nobody looks at. The list buys back a green baseline.

**What it does not do.** `ignore` suppresses exactly the ids named. A new
advisory against any of these same crates still fails the run, as does
any advisory anywhere else in the tree. The ids are also printed into the
job summary on every run, so a suppression cannot quietly outlive its
reason.

**Reviewing it.** Re-check when Tauri ships a GTK4/webkit6 Linux runtime,
and otherwise every few months. To test whether an entry can go, delete
the line and run `cargo audit`: if it stays quiet, the advisory is gone
and so should the line be.

Two places consume the list. `cargo audit` reads `.cargo/audit.toml`
itself. `rustsec/audit-check`, which runs on pull requests, does not — it
only takes an `ignore` input — so the workflow greps the ids out of the
file and passes them in, rather than keeping a second list to drift from
the first.

## Auto-fix

Runs `cargo audit fix` (raises a version requirement when clearing the
advisory needs a semver-incompatible bump — this subcommand is
experimental, so it is best-effort) and then `cargo update` (refreshes
the lockfile inside the existing ranges).

If nothing changed, it stops. If something changed it runs the same
gates as CI — `cargo fmt --check`, `cargo clippy -D warnings`,
`cargo test` — and only opens the PR when they pass. That check matters
more than it looks; see the token caveat below.

The PR body carries the manifest diff and the `cargo audit` output as it
stands *after* the update, so you can see at a glance whether the bump
actually cleared the advisory or only part of it.

It always reuses the branch `automation/cargo-update`, so a second run
updates the open PR rather than stacking a new one, and it always works
from the default branch — a pull request whose lockfile trips the audit
is the PR author's to fix, so audit failures from PRs are ignored here.

## Repository settings you have to enable

None of this works until two settings are on. Both are one-time.

**1. Let Actions create pull requests.**
Settings → Actions → General → *Workflow permissions*:

- Select **Read and write permissions**.
- Tick **Allow GitHub Actions to create and approve pull requests**.

Without the tick, the auto-fix run fails at the `create-pull-request`
step with `GitHub Actions is not permitted to create or approve pull
requests`. The per-workflow `permissions:` blocks cannot grant this —
it is an account/repository switch that caps what any token in the repo
is allowed to do.

If the repository belongs to an organization, the same switch exists at
the org level (Organization settings → Actions → General) and the org
setting wins. Turning it on for the repository alone is not enough if
the org has it off.

**2. Turn on Dependabot security updates.**
Settings → Code security → enable **Dependency graph**, **Dependabot
alerts**, and **Dependabot security updates**.

Version updates come from [dependabot.yml](../.github/dependabot.yml).
Security updates do not — they are driven by that setting, they ignore
the `groups` config, and they open one PR per advisory.

## CI and the merge queue

Auto-fix's verification is an early check. Every dependency PR must also
pass the ordinary `ready-to-merge` gate, receive review, and use the
[merge queue](MERGE-QUEUE.md) once it is enabled. No automation account has
a configured review, CI, or queue bypass.

With the default `GITHUB_TOKEN`, GitHub creates PR workflow runs in a state
that requires a maintainer to select **Approve workflows to run**. Do that
before reviewing CI or adding the PR to the queue. If no run appears on an
older GitHub deployment, a maintainer can close and reopen the PR to start
normal PR CI. Do not merge based only on the auto-fix workflow's checks.

The workflow supports an optional repository secret `AUTOMATION_TOKEN`.
A fine-grained PAT needs Contents and Pull requests read/write for this
repository. A suitable GitHub App installation token also works. These
credentials allow PR CI to start without the GITHUB_TOKEN approval prompt;
keep them limited to this repository and rotate them as needed. The default
path needs no additional credential. See [GitHub's workflow-trigger
rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Assignee

The PR and Dependabot config both assign `Muawiya-contact`, the
[CODEOWNER](../.github/CODEOWNERS). `github.repository_owner` resolves
to the `Coding-Moves` organization, and an organization cannot be an
assignee — so the username is written out rather than templated. Change
it in both files if ownership moves.

## Running it by hand

Both workflows have `workflow_dispatch`: Actions → pick the workflow →
**Run workflow**. Locally:

```
cargo install cargo-audit --features=fix --locked
cargo audit
cargo audit fix
cargo update
```

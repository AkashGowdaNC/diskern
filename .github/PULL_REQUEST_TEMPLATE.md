## What & why


## Checklist

- [ ] `cargo fmt --all` and `cargo clippy --workspace` are clean
- [ ] `cargo test --workspace` passes
- [ ] Commits are small and focused (one logical change each)
- [ ] Doesn't weaken a safety principle (read-only scans, quarantine
      over deletion, deterministic verdicts)
- [ ] User-visible changes have a unique fragment in `changelog.d/`
- [ ] PR dependencies and overlapping component edits are identified
- [ ] Applicable CI passes; use the merge queue once it is enabled

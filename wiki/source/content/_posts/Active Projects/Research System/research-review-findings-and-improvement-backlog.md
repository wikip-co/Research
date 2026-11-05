---
title: Research Review Findings and Improvement Backlog
description: Confirmed queue failures, editorial diagnostics, operational gaps and prioritized proposals.
status: Current
tags:
  - Documentation
  - Workflow
---

## Review result

**2026-11-04.** The project has strong deterministic gates, source packets, isolated content worktrees and a useful human review boundary. Its main weaknesses are state ownership/recovery, feedback after rejection, and operational/deployment reconciliation. This review did not relax validators or enable timers. {% post_link "Research Architecture and Statechart Atlas" %} contains the source-backed views and replay evidence; {% post_link "Research Runtime Restoration 2026-11-04" %} records runtime measurements.

## Prioritized findings

| Priority | Finding and evidence | Suggested change | Verification needed |
| --- | --- | --- | --- |
| Before unattended work | **Confirmed:** a stale worker can update a review-stopped job once `lease_owner` is cleared. Real queue functions reproduced the five-step path in a temporary DB. | Require lease generation/fencing token, owner and expected state in an atomic compare-and-swap update; protect stopped records. | Regression tests for both cleared-owner and claim/update races. Proposed TLA+ fencing model passes only its scoped invariant. |
| Before unattended work | **Confirmed:** crashing on the last allowed attempt leaves an expired `leased` job unclaimable (`attempt_count < max_attempts` excludes it). | Reconcile expired exhausted leases to a terminal state with an audit event; provide explicit operator recovery. | Crash/restart tests at every transition and max-attempt boundary; preserve retry budgets. |
| Next editorial experiment | **Observed:** the real paper returned valid JSON but entity and section-summary gates rejected its plan. | Manually classify each rejected passage/target pair before changing model, prompt or validator. Create minimal fixtures and a small acceptance set. | Show whether each case is a bad proposal, retrieval/context loss, or a validator false positive. No blanket gate bypass. |
| Before unattended work | **Observed:** credentials and schedules are incomplete; restored DB comes from an older NAS snapshot. | Restore authentication securely, verify backlog freshness, define backup/startup policy and then test one bounded job. | Auth presence and least-necessary read tests, SQLite backup/restore drill, restart behavior. |
| Delivery correctness | **Code boundary:** `pr_open` marks an article processed, but does not prove human merge, deployment or live revision. No live receipt was found in the examined worker path. | Distinct PR/merge/build/live receipts and reconciliation. | Delayed/failed dispatch, missing PR, failed Pages deploy and resumed build cases. |
| Authority consistency | **Code boundary:** the legacy triage Codex launcher uses broad execution permissions; the simple publisher's agent backend is read-only. | Make the UI an explicit thin front end to the same guarded job path, or visibly separate the legacy action and authority. | No accidental agent write authority, clear operator consent and consistent run telemetry. |
| Observability | **Code boundary:** doctor reports command/path presence, but not complete runtime/authentication/deployment health. | Add scoped read-only checks with clear unavailable/unauthenticated states; use metrics per pipeline stage. | Endpoint/schema, Git/content revision, credentials presence, disk/DB integrity and queue-age tests. |
| Maintainability | **Observed:** old docs/diagrams describe ROCm/MTP service, longer context, old home paths and multi-pass critics. | Preserve dated history but link the current local state and default simple path. | Fresh-clone setup and current-path smoke check. |
| Efficiency | **Measured:** dense Q8 generation was about 7.6 tokens/s; the actual prompt used 10,031 tokens in a 32K allocation. | Compare prompt evidence selection and backend/quantization using the same acceptance set; change one variable per experiment. | Separate input-prefill time, generated tokens/s, total latency, peak memory and editorial acceptance. Smaller configured context alone is not a measured speed fix. |
| Build simplification | **Code boundary:** content dispatch triggers a whole-site build, a generated-output repo update and a separate Docker image output. | Measure which outputs are actually required before removing any delivery path; document exact-SHA receipts. | Actual hosting integration, URLs and rollback expectations must be checked first. |

## What is confirmed versus inferred

The two queue cases are confirmed at the Python queue-function boundary with synthetic data. The replay deliberately advances lease expiry in the temporary database to make a long pause deterministic. It does not modify or inspect real mail rows. The full production concurrency schedule was not replayed, and no claim is made that the restored backlog is currently corrupted.

The live-paper rejection is a retained validator result, not proof that the model is inherently unsuitable. The current request selected 5,193 claim-context characters from a 64,248-character source body and 10,239 candidate-context characters across nine targets. That compression is an investigation lead, not an established root cause. The model call finished normally below the token cap; it did not fail from missing dependencies or an API timeout.

The earlier local DOI repair is a separate confirmed scraping defect: raw fallback selected a bibliography DOI for an article without its own DOI. The DOI repair and two tests are now committed and pushed in `research-tools` on `fix/iconium-local-runtime` (`9bb79a8`); they are not yet merged to main. Queue proposals in this article are **not implemented**.

## Review sequence with the owner

1. Walk through repository map, end-to-end lifecycle and current host view.
2. Inspect queue ownership using the current and proposed statecharts and replay path.
3. Compare one real-paper rejection with its source and target page; choose a concrete editorial acceptance criterion.
4. Agree on a narrow implementation change and test it against fixed fixtures.
5. Revisit service startup, backup/freshness and credentials.
6. Only then consider a bounded unattended trial, with PR creation explicit and human merge retained.

Suggested success measures are validated drafts per attempt, merged pages per week, human review minutes, rejection cause distribution, queue age and verified deployment delay. Definitions/targets still require owner agreement; run count alone is not useful throughput.

## Source anchors

- `gmail-reader/gmail_reader/app.py`: `claim_publication_job`, `set_publication_job_state`, `requeue_publication_job`, `ensure_db`.
- `wiki-automation/wiki_automation/cli.py`: `local_worker_command`.
- `wiki-automation/wiki_automation/local_publish.py`: `LocalLLMClient`, `AgentCLIClient`, `run_local_publish`, `validate_simple_draft_plan`, `validate_rendered_markdown`.
- `gmail-reader/gmail_reader/web.py`: `codex_command`, `run_job`.
- `content/.github/workflows/trigger-sites.yml`, `wikip.co/.github/workflows/generator.yml`, `wikip.co/scripts/prepare-content`.

All paths are relative to the owning workspace repository. See the atlas ledger for exact reviewed commits and local-change boundaries.

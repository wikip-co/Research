---
title: Research System Overview
description: Start here for code-backed architecture, current operating state, findings and decisions.
status: Current
overview: true
tags:
  - Documentation
  - Workflow
---

## Current state

**Inference verified 2026-11-06; restoration verified 2026-11-04, America/Los_Angeles.** This is the knowledge home for the Research coordinator and its independent `research-tools`, `content`, and `wikip.co` repositories. The selected local endpoint now uses Qwen3.8 Flash Next UD-Q4_K_XL on Vulkan with MTP, 32K context, and one slot. A controlled cold publisher request passes in 31 seconds.

The 2026-11-04 restoration verified FlareSolverr, the SQLite copy, and the triage UI. Its real-paper draft stopped at editorial gates. That record described unresolved Gmail/Cloudinary credentials and unattended operation. The later inference work processed no backlog and published no research content.

The project wiki is an ordinary tracked **`Research/wiki/` directory**, included when the `analysis/research-visual-review` branch (or a later main containing it) is cloned. It is not a submodule or a separate Git repository. The site is available on the LAN at [iconium:4010](http://iconium:4010/) following the owner’s LAN-access request on 2026-11-04; GitHub stores source/history, not a deployed wiki. No GitHub Pages or external wiki hosting is configured.

## Inference update, 2026-11-06

The owner requested stronger models and a balanced latency target after increasing the BIOS GPU reservation to 96 GiB. {% post_link "Research Inference Tuning with a 96 GiB GPU Reservation" %} records the controlled tests, loading failures, source-accuracy checks, and chosen Flash Next Vulkan/MTP profile. The endpoint remains loopback-only. The publisher's deterministic validator remains in force.

Later on November 6, the owner requested a temporary model shutdown for Halo Infinite. The unit reached `inactive/dead`, releasing about 80.84 GiB of GPU memory. The model remains selected but stopped until an operator restarts it. The tuning article records the evidence and recovery link.

## Start a walkthrough

1. {% post_link "Research Architecture and Statechart Atlas" %}: fourteen architecture views, three model-checked charts, editable sources, evidence and regeneration commands. Begin with the repository map, end-to-end diagram and lifecycle chart; then drill down into intake, scraping, planning, queue ownership and publication.
2. {% post_link "Research Review Findings and Improvement Backlog" %}: two queue failures confirmed against temporary synthetic databases, editorial-validation findings and prioritized proposals. Proposed designs are not deployed fixes.
3. {% post_link "Research Runtime Restoration 2026-11-04" %}: the measured host restoration, Qwen model/configuration, NAS recovery and first real-paper test.
4. {% post_link "Research Knowledge Ownership Decision 2026-11-04" %}: why knowledge lives here, how source/history is tracked, and future-agent working conventions.

## Repository and authority boundaries

| Owner | Purpose | Review boundary |
| --- | --- | --- |
| `Research` | Workspace coordination, operating docs, this wiki | Owns cross-repository explanation, not generated public research pages |
| `research-tools` | Five Python packages, scraping, SQLite queues, planning and Git orchestration | DOI repair merged through research-tools PR #4; queue findings are **not fixed** |
| `content` | Public research Markdown | Changes require explicit publishing and human PR review |
| `wikip.co` | Hexo application and GitHub build workflow | Consumes exact dispatched content SHA and writes generated output |
| `public` | Generated site repository | External Pages integration is distinct from source merge/build |
| `wiki/` | Architecture, decisions, evidence and historical findings | Tracked normally in Research; no raw mail/database/source packets or credentials |

The state of an alert occurrence, a canonical paper, a publishing job and a live deployment are separate facts. A `pr_open` job is not evidence of a human merge or a live article.

## Operating boundaries

The model and triage user units were started manually and remain disabled for automatic login start. FlareSolverr uses Docker `unless-stopped`. The NAS was mounted read-only for recovery through a transient mount; the live SQLite copy is local. Scholar-sync and automatic publisher timers are not enabled. The historical 262K-context Toolbx service has not been reproduced. The 2026-11-06 default uses Flash Next on Vulkan with MTP, 32K context, and one slot. Original BF16 27B also passed separate ROCm tests.

The queue model found a stale-worker overwrite path and an expired final-attempt lease that cannot be reclaimed. Both were replayed with real queue functions and synthetic temporary records; no production database row was modified. These are function-level proofs, not evidence that the restored production backlog has suffered those interleavings.

## Working with a future agent

From Research, read `AGENTS.md` and `wiki/AGENTS.md`, then:

```bash
node wiki/source/bin/wiki.js search "TOPIC"
node wiki/source/bin/wiki.js context "Research System"
```

Record dated observations, source revisions, decisions and owners. Update the owning article; do not create competing procedures. Existing `Research/docs/research-production-operations.md` and tooling docs remain authoritative operational procedures. New findings here qualify their dated claims rather than silently rewriting history.

## Next decisions

Prioritize lease fencing and exhausted-lease recovery before unattended work, then inspect the real-paper editorial rejection with its source/target evidence. Restore credentials only through approved secure mechanisms. Choose success metrics that distinguish runs, validated drafts, open PRs, merged pages and verified live delivery. The later inference work is recorded in the 2026-11-06 update above. Public hosting and auto-merge are outside that work.

## Source branch handoff

The wiki integration was prepared on `analysis/research-visual-review` in the existing Research repository and submitted as [Research PR #4](https://github.com/wikip-co/Research/pull/4). On 2026-11-04 the owner authorized merging the session PRs after passing checks. Source/edit links now target main for that merge. The DOI repair has merged through [research-tools PR #4](https://github.com/wikip-co/research-tools/pull/4); queue findings remain unfixed.

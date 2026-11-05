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

**Evidence date: 2026-11-04, America/Los_Angeles.** This is the knowledge home for the Research workspace: a coordinator plus the independent `research-tools`, `content` and `wikip.co` repositories. The local Qwen3.8 27B Vulkan endpoint, FlareSolverr and restored SQLite triage UI work. A real-paper draft completed but was stopped by editorial gates. Gmail/Cloudinary credentials and unattended operation remain unresolved. No research content was published by this review.

The project wiki is an ordinary tracked **`Research/wiki/` directory**, included when the `analysis/research-visual-review` branch (or a later main containing it) is cloned. It is not a submodule or a separate Git repository. The site is available on the LAN at [iconium:4010](http://iconium:4010/) following the owner’s LAN-access request on 2026-11-04; GitHub stores source/history, not a deployed wiki. No GitHub Pages or external wiki hosting is configured.

## Start a walkthrough

1. {% post_link "Research Architecture and Statechart Atlas" %}: fourteen architecture views, three model-checked charts, editable sources, evidence and regeneration commands. Begin with the repository map, end-to-end diagram and lifecycle chart; then drill down into intake, scraping, planning, queue ownership and publication.
2. {% post_link "Research Review Findings and Improvement Backlog" %}: two queue failures confirmed against temporary synthetic databases, editorial-validation findings and prioritized proposals. Proposed designs are not deployed fixes.
3. {% post_link "Research Runtime Restoration 2026-11-04" %}: the measured host restoration, Qwen model/configuration, NAS recovery and first real-paper test.
4. {% post_link "Research Knowledge Ownership Decision 2026-11-04" %}: why knowledge lives here, how source/history is tracked, and future-agent working conventions.

## Repository and authority boundaries

| Owner | Purpose | Review boundary |
| --- | --- | --- |
| `Research` | Workspace coordination, operating docs, this wiki | Owns cross-repository explanation, not generated public research pages |
| `research-tools` | Five Python packages, scraping, SQLite queues, planning and Git orchestration | Local DOI repair exists on `fix/iconium-local-runtime`; queue findings are **not fixed** |
| `content` | Public research Markdown | Changes require explicit publishing and human PR review |
| `wikip.co` | Hexo application and GitHub build workflow | Consumes exact dispatched content SHA and writes generated output |
| `public` | Generated site repository | External Pages integration is distinct from source merge/build |
| `wiki/` | Architecture, decisions, evidence and historical findings | Tracked normally in Research; no raw mail/database/source packets or credentials |

The state of an alert occurrence, a canonical paper, a publishing job and a live deployment are separate facts. A `pr_open` job is not evidence of a human merge or a live article.

## Operating boundaries

The model and triage user units were started manually and remain disabled for automatic login start. FlareSolverr uses Docker `unless-stopped`. The NAS was mounted read-only for recovery through a transient mount; the live SQLite copy is local. Scholar-sync and automatic publisher timers are not enabled. The old ROCm/MTP/262K-context service has not been reproduced: the baseline is Vulkan, 32K context and one slot.

The queue model found a stale-worker overwrite path and an expired final-attempt lease that cannot be reclaimed. Both were replayed with real queue functions and synthetic temporary records; no production database row was modified. These are function-level proofs, not evidence that the restored production backlog has suffered those interleavings.

## Working with a future agent

From Research, read `AGENTS.md` and `wiki/AGENTS.md`, then:

```bash
node wiki/source/bin/wiki.js search "TOPIC"
node wiki/source/bin/wiki.js context "Research System"
```

Record dated observations, source revisions, decisions and owners. Update the owning article; do not create competing procedures. Existing `Research/docs/research-production-operations.md` and tooling docs remain authoritative operational procedures. New findings here qualify their dated claims rather than silently rewriting history.

## Next decisions

Prioritize lease fencing and exhausted-lease recovery before unattended work, then inspect the real-paper editorial rejection with its source/target evidence. Restore credentials only through approved secure mechanisms. Choose success metrics that distinguish runs, validated drafts, open PRs, merged pages and verified live delivery. No model swap, validator relaxation, public hosting or auto-merge policy is approved by this review.

## Source branch handoff

The wiki integration is committed on `analysis/research-visual-review` in the existing Research repository. It is reviewable as a pull request; it must be merged before a default-main clone includes it. The source/edit links currently target that branch. After merge, update the source branch setting to main. The DOI repair is separately tracked on `research-tools/fix/iconium-local-runtime`.

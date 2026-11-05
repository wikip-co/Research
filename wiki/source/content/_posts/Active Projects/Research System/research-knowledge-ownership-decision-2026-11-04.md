---
title: Research Knowledge Ownership Decision 2026-11-04
description: Track project knowledge in Research/wiki while serving it locally only.
status: Current
tags:
  - Documentation
  - Workflow
---

## Decision and status

**Owner decision, 2026-11-04:** prepare a project-specific wiki inside Research and keep project diagrams, findings, decisions and history there. **Hosting remains local only.** The later request to commit and push the work makes this a normal tracked folder in the Research repository, not a separate repository with an unconfigured remote.

The initial preparation used an independent nested clone ignored by Research. Inspection showed that pushing Research would therefore omit the wiki. That intermediate arrangement is superseded: `wiki/` now has no `.git`, is not ignored, and must not be recorded as a gitlink. Its temporary template Git metadata was preserved privately under the parent `.git/` during conversion; the original template checkout was not changed. No submodule or new GitHub repository is needed.

## Ownership rules

- This wiki owns new Research-specific findings, architecture, diagrams, modelling assumptions, decisions and handoffs.
- Existing runtime/tooling docs remain the canonical executable procedures. Link them; date discrepancies rather than maintaining competing copies.
- `content` continues to own public research articles; this wiki does not belong in the public natural-healing publishing pipeline.
- The central agent wiki remains a cross-project index and frozen record of earlier sessions. Its existing historical pages are not silently deleted or renamed. A future pointer update can link the project repository; it does not deploy this local site.
- No raw email/database data, credentials or complete model/source packets belong in the knowledge repository.

## Future-agent startup

{% post_link "Research System Overview" %} is the entry point. Read the coordinator and wiki AGENTS instructions, search, load context, check each repository status, and preserve pre-existing changes. Record confirmed evidence separately from proposals and model-only paths. Commit diagram source, renders and review notes together.

```bash
cd "$HOME/Projects/Research"
node wiki/source/bin/wiki.js search "TOPIC"
node wiki/source/bin/wiki.js context "Research System"
```

## Storage and hosting are separate

Git pushes back up source/history to the existing Research repository. They do not enable GitHub Pages, expose a LAN service or change Cloudflare routing. The local static server binds only to `127.0.0.1:4010`; building writes ignored `wiki/docs/`. The root Research Knowledge Wiki workflow validates source on PR/push. Generated output is never committed.

The wiki template's generic standalone Docker/deployment files are retained as reference capability, not activated hosting. A future deployment choice needs an explicit request and review of audience, routes and credentials.

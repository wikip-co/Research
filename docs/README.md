# Research Workspace Documentation

Cross-repository documentation and agent guidance lives here so a workspace checkout has one discovery point.

Repository-boundary instructions for coding agents start in [`../AGENTS.md`](../AGENTS.md).

- [`content-publishing-runbook.md`](content-publishing-runbook.md): end-to-end content, site build, and publish operations.
- [`research-production-operations.md`](research-production-operations.md): canonical administration guide for ad-hoc URLs, passive Scholar queues, packet validation, local llama.cpp, services, backups, draft PRs, and troubleshooting.
- [`natural-healing-content-style-guide.md`](natural-healing-content-style-guide.md): required structure and citation style for Natural Healing articles.
- [`database-architecture-and-migration.md`](database-architecture-and-migration.md): implemented SQLite queue architecture and optional future PostgreSQL migration plan.
- [`diagrams/README.md`](diagrams/README.md): illustrated system map, end-to-end workflows, runtime topology, and per-repository architecture, with editable generator specifications.

Tool-specific implementation documentation remains with the tool that owns it. In particular, the [local publisher guide](../research-tools/docs/local-research-publisher.md) and general [research publishing guide](../research-tools/docs/research-publishing-style-guide.md) are maintained in `research-tools`.

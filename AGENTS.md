# Research Workspace Agent Instructions

This repository is a flat coordinator for several standalone repositories. Read [`docs/README.md`](docs/README.md) before cross-repository work.

## Repository boundaries

- Never add Git submodules or commit gitlinks to `Research` or `wikip.co`.
- `workspace-repos.tsv` declares the local development repositories; use `./workspace sync` and `./workspace status` from the Research root.
- Make code, content, and site commits in the repository that owns those files. Research owns only workspace coordination, cross-repository documentation, and agent guidance.
- Treat `wikip.co/site/source/_posts` and `wikip.co/public` as ignored build material. Do not edit generated HTML.

## Content guidance

- Follow [`docs/content-publishing-runbook.md`](docs/content-publishing-runbook.md) for the content-to-site flow.
- Follow [`docs/natural-healing-content-style-guide.md`](docs/natural-healing-content-style-guide.md) for Natural Healing articles.
- Follow the general [`research-tools` publishing guide](https://github.com/wikip-co/research-tools/blob/main/docs/research-publishing-style-guide.md) for evidence, citations, and content PRs.

## Validation

- Validate the coordinator with `bash -n workspace` and `./workspace validate`.
- After editing an architecture specification, run `docs/diagrams/render-diagrams` and commit the YAML source with its SVG and PNG renders.
- On an upgraded legacy checkout, require `./workspace verify-layout` to pass; `workspace sync` alone does not detach old submodule gitdirs.
- Validate site integration with `wikip.co/scripts/build-site`; it fetches or copies content without nesting Git metadata.
- Inspect each repository's `git status` separately before handing off changes.

## Project knowledge and visual review

Research knowledge lives only in the main Agent Wiki at
`~/Projects/agent-wiki`, served at [agent.wikip.co](https://agent.wikip.co/).
Do not recreate a nested wiki in this repository. Research owns workspace
coordination and operational docs; Agent Wiki owns architecture, findings,
decisions, evidence, and history.

Before project work, read the main wiki's `AGENTS.md`, then run from its root:

```bash
cd "$HOME/Projects/agent-wiki"
node source/bin/wiki.js search "TOPIC"
node source/bin/wiki.js context "Research System"
```

Use [Research System Overview](https://agent.wikip.co/research-system-overview/)
without a local checkout. Update owning articles when findings change. Keep
operational procedures in their owning tooling repository and link to them.
Preserve evidence dates, source revisions, and confirmed-versus-model-only labels.
Never copy raw mail/database records, credentials, or full model prompts into the wiki.

Atlas specifications and artifacts live in Agent Wiki under
`source/content/artifacts/research-architecture-and-statechart-atlas/`.
Run its `scripts/render-research-atlas` and commit source models with SVG/PNG
and reports there. The historical `docs/diagrams/render-diagrams` script in
Research still owns its separate `docs/diagrams/specs/` outputs.

Validate wiki changes in Agent Wiki with its lint, tests, clean/build, and
link/export checks. Use focused branches and PRs in each owning repository.
Inspect all standalone workspace repository statuses separately.

## Cursor Cloud development

The earlier cloud setup used Git submodules. That layout is historical: use the
current flat-workspace commands below instead of recursive submodule init or
committing generated site output.

- Read `docs/README.md`, then run `./workspace sync`, `./workspace validate` and
  `./workspace verify-layout`. Child repositories keep their own Git history.
  If a cloud token supports only HTTPS, set `RESEARCH_GIT_PROTOCOL=https` for `./workspace sync`; do not change tracked repository URLs or copy credentials into files.
- In `research-tools`, follow its README and Python version requirement, run
  `uv sync --all-packages` and `make test`. `./agent-workflow doctor` checks
  prerequisites; credential presence does not establish service health.
- Cloud environments may lack Gmail, Vault, Cloudinary or model access. Use
  temporary synthetic fixtures for UI tests. Never seed the restored production
  database or assume a startup script provisioned dependencies or credentials.
- Follow `research-tools` triage instructions for the current database path,
  bind address and filters. For review-state rows, use `?status=review`. Any cloud
  preview exposure requires the intended task scope; preserve loopback defaults.
- Build the public site using `wikip.co/scripts/build-site` and the publishing
  runbook. Generated `wikip.co/public` and `site/source/_posts` are ignored build
  material. Project knowledge lives in the separate Agent Wiki repository.

The original PR's cloud screenshots and test counts are historical observations,
not verification of today's host or a fresh cloud environment.

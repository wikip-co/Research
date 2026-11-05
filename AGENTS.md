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

The project wiki at `wiki/` is the home for Research architecture, statecharts,
findings, decisions and history. It is a normal tracked directory in this repo,
not a submodule or independent repository. A Research clone contains the wiki.

Before project work, read `wiki/AGENTS.md`, then run:

```bash
node wiki/source/bin/wiki.js search "TOPIC"
node wiki/source/bin/wiki.js context "Research System"
```

Update owning articles when findings or decisions change. Keep operational
procedures in their existing owning tooling repository and link them from the
wiki instead of maintaining competing instructions. Preserve evidence dates,
source code revisions and confirmed-versus-model-only labels. Never copy raw
mail/database records, credentials or full model prompts into the wiki.

The LAN site is served on http://iconium:4010 (port 4010 is allowed from the local subnet). GitHub stores source/history only;
no GitHub Pages or external wiki deployment is configured. Source lives under
`wiki/source/content/_posts`, diagrams and model sources under the owning
article's `wiki/source/content/artifacts/` directory. Do not edit `wiki/docs/`.

For wiki atlas specifications, run `wiki/scripts/render-research-atlas` and commit
its source models/specs with SVG/PNG and reports. The older
`docs/diagrams/render-diagrams` remains the regeneration path for its historical
`docs/diagrams/specs/` sources; do not mix the two output owners.

After wiki changes, run its lint, tests, clean/build and link/export checks.
The root Research Knowledge Wiki CI workflow validates the nested site. Future
changes should use focused branches and PRs; pushing source is not publishing a
new external website. Inspect all standalone workspace repo statuses separately.

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
  material. The project knowledge wiki at `wiki/` is a separate site.

The original PR's cloud screenshots and test counts are historical observations,
not verification of today's host or a fresh cloud environment.

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

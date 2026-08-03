# Wikip.co Content Publishing Runbook

This workspace-level runbook documents the path from research ingestion to the live `wikip.co` site.

## Repository roles

- `research-tools`: discovery, scraping, packet creation, and content updates.
- `content`: markdown source of truth and downstream rebuild dispatch.
- `wikip.co`: Hexo application and build/deploy workflow.
- `public`: generated static HTML deployed by Cloudflare Pages.

Each is a standalone repository. No repository records another as a submodule.

![Exact-SHA content publishing pipeline](diagrams/rendered/cicd-exact-sha-publishing.svg)

The [architecture diagram gallery](diagrams/README.md) also covers the upstream research workflow and each repository's internal boundary.

## End-to-end flow

1. An agent or human changes markdown in `content` and opens a PR there.
2. After merge to `content/main`, `trigger-sites.yml` sends a `content-updated` repository dispatch containing the exact content SHA.
3. `wikip.co/.github/workflows/generator.yml` checks out the site, that content SHA with full history, and `wikip-co/public` as separate build inputs.
4. `scripts/prepare-content` copies publishable content into `site/source/_posts` without its `.git` directory, applies `site-content-excludes.txt`, and restores markdown mtimes from Git history.
5. Hexo generates a clean `public` output tree.
6. Actions synchronizes that output into its temporary `wikip-co/public` checkout, commits any changes, and pushes `main`.
7. Cloudflare Pages deploys the generated repository. The same run builds and pushes the Docker image.

## Local verification

From `wikip.co`, with a sibling `content` checkout:

```bash
./scripts/build-site
```

Or select another standalone content checkout:

```bash
CONTENT_REPO_ROOT=/path/to/content ./scripts/build-site
```

If neither is supplied, the helper creates an ignored managed checkout in `.build/content-repo`. Use `CONTENT_REF=<revision>` to select a branch, tag, or SHA for that managed checkout.

The local build never commits or pushes generated output.

## Agent workflow expectations

- Make content changes only in the `content` repository.
- Do not hand-edit or commit generated HTML.
- Keep site configuration, theme, and deployment changes in `wikip.co`.
- Open the PR in the repository that owns the changed files.

## Troubleshooting

If a deploy fails:

- Confirm the dispatch payload contains the expected `content_sha`.
- Confirm the `Check out content` step resolved that exact SHA.
- Confirm `GIT_ACCESS_TOKEN` can read `content` and push to `wikip-co/public`.
- Reproduce content preparation with `CONTENT_REF=<sha> ./scripts/prepare-content`.
- Reproduce the complete site build with `./scripts/build-site`.
- If content merged but no build started, inspect `content/.github/workflows/trigger-sites.yml` and its `TRIGGER_TOKEN` secret.

Hexo uses `updated_option: 'mtime'`. The content checkout therefore needs full history, and `prepare-content` must restore each tracked markdown file's timestamp before the build.

## Migration note

Before this model, `site/source/_posts` and `public` were nested submodules and deploy logic lived in a reusable workflow in `content`. The current model intentionally keeps build logic with the site and materializes both external repositories only for local builds or CI runs.

# Research Workspace

This repository is a thin workspace wrapper around the project repos used to discover research papers, turn them into wiki content, and publish the generated site.

## Project Map

- `research-tools`: agent-facing tooling for research intake, Gmail/Google Scholar alert parsing, scraping, article matching, image upload, source archiving, and content PR creation.
- `content`: the markdown source of truth for wiki articles.
- `wikip.co`: the Hexo site that builds and publishes the markdown from `content`.

High-level flow:

```text
Gmail / Google Scholar alerts
  -> research-tools/gmail-reader
  -> SQLite research intake DB
  -> research-tools/web-scraper + wiki-automation
  -> content markdown PR
  -> wikip.co Hexo build
  -> wikip-co/public / Cloudflare Pages
```

## Repository Layout

The top-level repo is a Git superproject. It records pinned commits for these submodules:

- `content`: `git@github.com:wikip-co/content.git`
- `research-tools`: `git@github.com:wikip-co/research-tools.git`
- `wikip.co`: `git@github.com:wikip-co/wikip.co.git`

`wikip.co` also has nested submodules:

- `wikip.co/site/source/_posts`: `wikip-co/content`, used by Hexo as the markdown source.
- `wikip.co/public`: `wikip-co/public`, used for generated static assets.

The workspace repo itself should stay small. Most code, content, branches, commits, and PRs belong in the child repos.

## Should This Use Submodules?

Submodules are reasonable here because this workspace is mainly a reproducible checkout for agents and operators. A single clone can bring together the tools repo, the content repo, and the site repo at known commits.

The tradeoff is operational overhead:

- the workspace can look modified when a submodule is simply checked out at a newer commit
- updating a child repo does not automatically update the workspace's pinned commit
- submodule pointer conflicts can happen if multiple people update the workspace pins independently

Recommended rule:

- Keep this workspace repo for setup, reproducibility, and cross-repo orientation.
- Do day-to-day development inside `research-tools`, `content`, or `wikip.co`.
- Open PRs in the child repo that actually changed.
- Update and commit the top-level submodule pointers only when you intentionally want future workspace clones to start from newer child-repo commits.

Cloning each repo separately is also fine when you are actively working in only one repo and do not need the full workspace. For agent work, this workspace is still useful because it gives the agent the whole operating context.

## Clone And Sync

Clone everything in one step:

```bash
git clone --recursive <workspace-repo-url>
```

If the workspace was cloned without submodules:

```bash
git submodule update --init --recursive
```

Check current submodule state:

```bash
git submodule status --recursive
```

Pull the workspace repo and then reset submodules to the commits recorded by the workspace:

```bash
git pull
git submodule update --init --recursive
```

If you intentionally want newer child repo commits pinned by the workspace, update the child repo, return to this top-level repo, and commit the changed submodule pointer.

## Main Working Repo: `research-tools`

`research-tools` is the operational toolchain for agents. It is a Python `uv` workspace with these packages:

- `gmail-reader`: reads Google Scholar alert emails via `gws`, parses article candidates, and stores them in SQLite.
- `wiki-automation`: searches and matches existing markdown, builds queues, runs intake, appends research, archives sources, and opens/publishes content PRs.
- `web-scraper`: scrapes article URLs and PDFs into structured JSON/markdown packets, with optional browser fallback.
- `image-upload`: uploads article images or captured screenshots to Cloudinary.
- `content-agent-core`: shared runtime helpers.

From `research-tools`, the preferred entrypoint is:

```bash
./agent-workflow doctor
./agent-workflow triage-ui
./agent-workflow queue --topic "health nutrition"
./agent-workflow backlog --open-access --min-score 18 --limit 20
./agent-workflow intake "<url-or-pdf>" --archive
./agent-workflow append "<url>" --target "path/to/article.md" --apply
./agent-workflow publish-pr --draft
```

The triage UI is a LAN-accessible browser interface for the SQLite intake DB. It can mark article rows as `selected`, `review`, `rejected`, or `invalid`, and it can launch background Codex jobs that process selected rows and submit draft PRs to `content`.

Current local UI command:

```bash
cd research-tools
./agent-workflow triage-ui --db gmail-reader/data/scholar-alerts.db --host 0.0.0.0 --port 8765
```

Current local URLs:

- local machine: `http://127.0.0.1:8765`
- LAN address observed on `2026-05-05`: `http://10.32.25.37:8765`

The UI intentionally has no authentication because it is meant for a trusted local network.

The UI is managed by a user-level systemd service:

```bash
systemctl --user status research-triage-ui.service
systemctl --user start research-triage-ui.service
systemctl --user stop research-triage-ui.service
systemctl --user restart research-triage-ui.service
systemctl --user enable research-triage-ui.service
```

Service file:

```text
~/.config/systemd/user/research-triage-ui.service
```

Tracked service template:

```text
research-tools/systemd/research-triage-ui.service
```

Reinstall/reproduce the service:

```bash
mkdir -p ~/.config/systemd/user
cp research-tools/systemd/research-triage-ui.service ~/.config/systemd/user/research-triage-ui.service
systemctl --user daemon-reload
systemctl --user enable research-triage-ui.service
systemctl --user start research-triage-ui.service
```

If the workspace path is not `/home/anthony/Research`, edit the copied service file before `daemon-reload`.

Web UI implementation notes:

- entrypoint: `research-tools/gmail-reader/gmail_reader/web.py`
- console script: `gmail-reader-web`
- wrapper command: `research-tools/agent-workflow triage-ui`
- Docker Compose exposes `${GMAIL_READER_WEB_PORT:-8765}:8765`
- job state tables added on first web startup: `article_jobs` and `article_job_items`
- successful Codex jobs set `articles.processed_at`; rows are not deleted
- Codex jobs are prompted to read `research-tools/docs/research-publishing-style-guide.md`

Important runtime expectations:

- `uv`, `git`, `jq`, `gh`, `gws`, and Vault access are expected for the full workflow.
- Secrets are loaded from Vault through `research-tools/auth-bootstrap` and `.env`.
- The content repo is mounted or discovered via `CONTENT_REPO_ROOT`, `CONTENT_REPO_SOURCE_PATH`, or the managed clone at `research-tools/runtime/content-repo`.
- Generated packets and runtime state should stay out of Git.

## Research Intake Database

The remembered SQLite database exists. The active schema is managed by `research-tools/gmail-reader`.

Default local paths:

- standalone tool default: `research-tools/gmail-reader/data/scholar-alerts.db`
- Docker/runtime mount: `research-tools/runtime/gmail-reader/scholar-alerts.db`
- container path: `/var/lib/content-agent/gmail-reader/scholar-alerts.db`

The useful backup is on the NAS:

```text
/mnt/naspi5/content-agent-backups/gmail-reader/scholar-alerts-latest.db
```

The same file is visible over SSH on `naspi5` at:

```text
/mnt/raid5/content-agent-backups/gmail-reader/scholar-alerts-latest.db
```

Last observed NAS backup, checked from this workspace on `2026-05-05`:

- backup timestamp: `2026-03-09 21:04`
- size: about `1.3 GB`
- messages: `18,753`
- parsed article rows: `168,677`
- alert topics: `77`
- article statuses: `145,896 review`, `15,910 selected`, `6,871 rejected`
- message date range: `2025-08-01` through `2025-12-31`

Current local working copy:

- restored from the NAS backup into `research-tools/gmail-reader/data/scholar-alerts.db`
- size: about `1.3 GB`
- ignored by Git through `research-tools/.gitignore`
- used by the currently running web UI

To restore the NAS backup into the local runtime path:

```bash
cp /mnt/naspi5/content-agent-backups/gmail-reader/scholar-alerts-latest.db \
  research-tools/runtime/gmail-reader/scholar-alerts.db
```

Or over SSH:

```bash
scp naspi5:/mnt/raid5/content-agent-backups/gmail-reader/scholar-alerts-latest.db \
  research-tools/runtime/gmail-reader/scholar-alerts.db
```

Use a single active writer for the SQLite database. A local primary DB plus scheduled NAS backup is safer than multiple machines writing to the same SQLite file.

## Research Style Guide

The agent publishing style guide lives at:

```text
research-tools/docs/research-publishing-style-guide.md
```

It tells agents to:

- write only to `content` markdown, not generated site output
- prefer updating existing articles over creating duplicates
- preserve frontmatter, heading style, tags, citations, and footnote style
- cite every research-backed claim
- state evidence limits clearly, especially for preliminary, mechanistic, animal, in vitro, or observational research
- avoid medical advice language
- open a draft PR in `content` for review

## Publishing Flow

Normal research-to-site workflow:

1. Use `research-tools` to search Gmail/Scholar alerts or the stored backlog.
2. Optionally use `./agent-workflow triage-ui` to curate rows in a browser and launch a Codex processing job.
3. Scrape the selected URL/PDF.
4. Match the source against existing markdown in `content`.
5. Append to an existing article or create a new markdown article in `content`.
6. Commit and open a PR in `content`.
7. After merge to `content/main`, the content repo dispatches a downstream rebuild.
8. `wikip.co` builds Hexo with the exact content commit and pushes generated output to `wikip-co/public`.
9. Cloudflare Pages publishes from `wikip-co/public`.

Agents should not write generated HTML directly. The source of truth is markdown in `content`; generated site output is downstream.

## Common Checks

Top-level workspace:

```bash
git status --short
git submodule status --recursive
```

Research tools:

```bash
cd research-tools
./agent-workflow doctor
uv sync --all-packages
make test
```

Site build:

```bash
cd wikip.co
git submodule update --init --recursive
npm ci --prefix site
NODE_OPTIONS=--max-old-space-size=5168 npm --prefix site run build
```

## Current Workspace Notes

At the time this README was refreshed on `2026-05-05`, the top-level workspace had newer checked-out commits for:

- `content`: workspace pin `74edd067...`, checkout `463d66a...`
- `research-tools`: workspace pin `31859f8...`, checkout `80d0f64...`

That is why the top-level `git status` reports those submodules as modified even though the child repos themselves are clean. Commit the pointer updates in this workspace only if those newer child commits should become the default checkout for future users/agents.

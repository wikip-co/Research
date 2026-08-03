# Research Workspace

This repository is a thin workspace wrapper around the project repos used to discover research papers, turn them into wiki content, and publish the generated site.

**Operators / Hermes handoff:** see [`RELEASE_NOTES.md`](./RELEASE_NOTES.md) for current host layout (iconium), managed checkout state, recent cross-repo changes, and a pickup checklist. Tool-level detail lives in the [`research-tools` release notes](https://github.com/wikip-co/research-tools/blob/main/RELEASE_NOTES.md).

Cross-repository runbooks and agent guidelines are indexed in [`docs/README.md`](docs/README.md).

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

This repository is a flat coordinator. It tracks workspace documentation, the repository manifest, and the `./workspace` helper; it does not track child repositories or their revisions as Git submodules.

`workspace-repos.tsv` declares the independently versioned repositories used here:

- `content`: `wikip-co/content`
- `research-tools`: `wikip-co/research-tools`
- `wikip.co`: `wikip-co/wikip.co`

The helper clones those repositories into the familiar top-level paths. Those paths are ignored by Research, so each child has an independent branch, index, and remote without creating gitlink changes in the coordinator repository.

The site repository follows the same boundary: CI fetches `content` and `public` explicitly at build time. `site/source/_posts` and `public` are ignored build inputs/outputs rather than tracked submodules.

Research CI validates the manifest and rejects future gitlinks or `.gitmodules`; it does not clone child repositories.

## Clone And Sync

Clone the coordinator and fetch the working repositories:

```bash
git clone git@github.com:wikip-co/Research.git
cd Research
./workspace sync
```

Use HTTPS instead of SSH when needed:

```bash
RESEARCH_GIT_PROTOCOL=https ./workspace sync
```

Check all child repository states without affecting them:

```bash
./workspace status
```

`sync` clones missing repositories and fast-forwards a checkout only when it is clean and already on the manifest branch. It fetches but does not switch branches, detach HEAD, reset work, or overwrite local changes.

To update the coordinator and working repositories:

```bash
git pull --ff-only
./workspace sync
```

## Migrating An Existing Submodule Workspace

`workspace sync` does not silently rewrite Git storage for an existing checkout. After pulling the commits that remove the old gitlinks, explicitly detach the legacy layout once:

```bash
./workspace migrate --check
./workspace migrate
./workspace verify-layout
```

The migration performs a complete preflight before moving anything. It preserves each top-level repository's HEAD, branch, index, untracked files, and dirty state, then verifies that their status fingerprints are unchanged. The former `wikip.co/public` and `wikip.co/site/source/_posts` repositories must be clean, fully pushed, ignored by `wikip.co`, and free of stashes; they become plain build directories.

Expected verification output:

```text
Standalone: research-tools
Standalone: content
Standalone: wikip.co
Plain build directory: wikip.co/public
Plain build directory: wikip.co/site/source/_posts
```

Legacy nested metadata is moved to a timestamped recovery backup under `.git/legacy-submodule-backups/`. Keep that backup until the site build and normal repository operations have been verified.

## Main Working Repo: `research-tools`

`research-tools` is the operational toolchain for agents. It is a Python `uv` workspace with these packages:

- `gmail-reader`: reads Google Scholar alert emails via `gws`, parses article candidates, and stores them in SQLite.
- `wiki-automation`: searches and matches existing markdown, builds queues, runs intake, appends research, archives sources, and opens/publishes content PRs.
- `web-scraper`: scrapes article URLs and PDFs into structured JSON/markdown packets, with FlareSolverr (Cloudflare) and optional browser fallback. Full text preferred; abstract-only is acceptable for paywalls.
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

The proposed PostgreSQL architecture and migration sequence are documented in
[`docs/database-architecture-and-migration.md`](docs/database-architecture-and-migration.md).

## Research Style Guide

The agent publishing style guide lives at:

```text
research-tools/docs/research-publishing-style-guide.md
```

Natural Healing articles also follow the workspace-level guide:

```text
docs/natural-healing-content-style-guide.md
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
./workspace status
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
./scripts/build-site
```

The site helper uses the sibling `content` checkout when available. Set `CONTENT_REPO_ROOT` to use a different content checkout; otherwise it creates an ignored build-time checkout under `wikip.co/.build/`.

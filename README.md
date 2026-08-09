# Research Workspace

Research is a flat coordinator for the independently versioned repositories
that discover papers, prepare evidence-faithful Markdown, and publish
`wikip.co`. It contains the cross-repository documentation, architecture
diagrams, repository manifest, and `workspace` helper; it does not contain the
child repositories as submodules.

Start with:

- [Production operations](docs/research-production-operations.md) — daily
  administration, ad-hoc URLs, passive queues, services, backups, local LLM,
  activation, and troubleshooting.
- [Natural Healing content style](docs/natural-healing-content-style-guide.md)
  — authoritative near-verbatim bullet and citation rules.
- [Content publishing runbook](docs/content-publishing-runbook.md) — the path
  from a reviewed content PR to the live site.
- [Architecture diagram gallery](docs/diagrams/README.md) — editable specs and
  all system, service, tool, database, and repository views.
- [Release notes](RELEASE_NOTES.md) — current implementation and handoff state.

## End-to-end architecture

Two intake paths feed the same guarded production pipeline:

- an operator passes an ad-hoc article URL or PDF to the local publisher; or
- Google Scholar alerts are read from Gmail, stored and triaged in SQLite, then
  queued for passive processing.

The scraper produces a validated research packet, deterministic code performs
deduplication and hybrid content matching, the local llama.cpp model produces a
structured draft and critic review, and hard validators decide whether a patch
is safe. Publication mode can open a **draft** PR in `content`; it never
auto-merges. A merged content PR triggers the exact-SHA Hexo build and
Cloudflare Pages deployment.

![Local LLM Research Publisher production flow](docs/diagrams/rendered/local-publisher-production-flow.svg)

![Research project repository ecosystem](docs/diagrams/rendered/project-repository-ecosystem.svg)

## Repository map

`workspace-repos.tsv` declares the managed sibling repositories:

- `research-tools` — Gmail/Scholar intake, SQLite state, scraping, source
  packets, local-model orchestration, validation, images, and content PRs.
- `content` — Markdown publication source of truth.
- `wikip.co` — Hexo application and exact-SHA build/deployment workflow.

`wikip-co/public` is a separate automation-owned generated-output repository
used by Cloudflare Pages; it is materialized by the site build rather than
managed as a workspace child.

Each top-level child has its own `.git`, branch, index, and remote. The
coordinator ignores those paths and CI rejects gitlinks or `.gitmodules`.

## Clone, sync, and inspect

```bash
git clone git@github.com:wikip-co/Research.git
cd Research
./workspace sync
./workspace status
./workspace verify-layout
```

Use HTTPS when required:

```bash
RESEARCH_GIT_PROTOCOL=https ./workspace sync
```

`sync` clones missing repositories and fast-forwards only a clean checkout
already on its manifest branch. It fetches but does not switch branches,
detach HEAD, reset work, or overwrite local changes.

Update the workspace safely:

```bash
git pull --ff-only
./workspace sync
./workspace status
```

### One-time legacy submodule migration

For a checkout created before the flat-repository model:

```bash
./workspace migrate --check
./workspace migrate
./workspace verify-layout
```

Migration performs a complete preflight, preserves the top-level repositories'
HEAD, branch, index, untracked files, and dirty state, and verifies their status
fingerprints. Legacy metadata is moved to a timestamped recovery directory
below `.git/legacy-submodule-backups/`; keep it until normal build and Git
operations have been verified.

## Main operational entrypoint

Run from `research-tools`:

```bash
cd research-tools
./agent-workflow doctor
./agent-workflow --help
```

Common paths:

```bash
# Ad-hoc source: dry run, then explicitly allow a draft PR.
./agent-workflow local-publish 'https://example.org/paper'
./agent-workflow local-publish 'https://example.org/paper' --publish

# Database backlog: bounded enqueue and one-job worker.
./agent-workflow enqueue-local-backlog --status selected --min-score 12 --limit 10
./agent-workflow local-worker --max-jobs 1
./agent-workflow local-worker --max-jobs 1 --publish

# Intake and manual research tools.
./agent-workflow triage-ui
./agent-workflow backlog --open-access --min-score 18 --limit 20
./agent-workflow intake 'https://example.org/paper' --archive
./agent-workflow search 'topic'
./agent-workflow match 'topic'
./agent-workflow check-ref 'https://example.org/paper'
```

![Research Tools commands and package ownership](docs/diagrams/rendered/research-tools-command-map.svg)

Tool-level details live in
[`research-tools/README.md`](research-tools/README.md) and
[`research-tools/docs/local-research-publisher.md`](research-tools/docs/local-research-publisher.md).

## Runtime baseline on iconium

Observed on 2026-08-09:

- the triage UI user service is active on port `8765`;
- the Qwen3.6 35B A3B Q8_0 llama.cpp service is active on port `8080`;
- the `research-flaresolverr` Podman container is active on port `8191`;
- the SQLite-to-NAS backup timer is enabled and healthy; and
- Scholar sync and local publisher timers are tracked templates, but are not
  installed or enabled.

That final distinction is intentional: unattended queue processing must be
activated only after dry-run patch review. The copied local-publisher unit
contains `--publish`, which authorizes draft-PR creation but still cannot merge.

![Iconium services, containers, and schedules](docs/diagrams/rendered/operator-services-and-schedules.svg)

The local model API defaults are:

```text
LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
LOCAL_LLM_MODEL=qwen3.6-35b-a3b-q8_0-mtp
```

The active server uses `-np 1`, so the publisher is intentionally configured
for one job at a time. See the production operations guide for health checks,
logs, model switching, timers, queue queries, and recovery.

## Database and backups

The active primary is:

```text
research-tools/gmail-reader/data/scholar-alerts.db
```

The local publisher adds durable `publication_jobs` and
`publication_job_events` tables alongside the Gmail intake, canonical paper,
and legacy Codex job tables. Jobs use atomic leases and bounded retries.

The enabled nightly backup writes dated snapshots and
`scholar-alerts-latest.db` under:

```text
/mnt/naspi5/content-agent-backups/gmail-reader
```

It uses SQLite's online backup API and validates the result. Keep the live
SQLite file local with one publisher worker; do not use a network-mounted live
database. PostgreSQL remains a future architecture option, not a production
dependency.

![Research database relationships](docs/diagrams/rendered/research-database-schema.svg)

## Style and safety

Natural Healing output follows
[`docs/natural-healing-content-style-guide.md`](docs/natural-healing-content-style-guide.md)
as the authoritative baseline. Its near-verbatim bullet style was preserved.
The publisher requires exact source quotations for proposed bullets, checks
claim strength against study type, rejects bot/CAPTCHA/error pages regardless
of response length, verifies DOI/title identity, and fails closed when content
placement is uncertain.

Generated HTML is never edited directly. All authoring changes belong in
`content`, and every automated publication remains a draft PR for human review.

## Common validation

Coordinator:

```bash
bash -n workspace
./workspace validate
./workspace status
```

Research tools:

```bash
cd research-tools
bash -n agent-workflow scripts/sync-scholar-alerts
uv run pytest -q
./agent-workflow doctor
```

Site build:

```bash
cd wikip.co
./scripts/build-site
```

Regenerate all diagrams through the containerized `~/diagram-generator`
toolchain:

```bash
docs/diagrams/render-diagrams
```

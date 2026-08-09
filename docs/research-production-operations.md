# Research Production Operations

This is the canonical operator guide for the Research workspace on `iconium`.
It covers intake, scraping, local-model authoring, database queues, draft pull
requests, services, backups, and downstream site publication.

The production publisher is deliberately fail-closed. Its unattended unit can
open **draft** content pull requests, but nothing in this path auto-merges a PR
or writes generated HTML.

## System at a glance

There are two intake paths and one guarded publication pipeline:

- **Ad-hoc:** pass an HTTP(S) article URL or local PDF to `local-publish`.
- **Passive:** sync Google Scholar alert emails, select candidates in SQLite,
  enqueue them, and let `local-worker` claim one due job at a time.

Both paths scrape and validate a research packet, deduplicate and match the
source, ask the local llama.cpp model for a structured draft and critic pass,
run deterministic quality gates, and prepare an isolated content patch. A
draft PR is possible only with `--publish`.

![Local LLM Research Publisher production flow](diagrams/rendered/local-publisher-production-flow.svg)

Repository responsibilities remain separate:

- `Research` owns cross-repository documentation, diagrams, and workspace
  coordination.
- `research-tools` owns ingestion, the SQLite schema, retrieval, model
  orchestration, validation, and content PR creation.
- `content` owns Markdown source articles.
- `wikip.co` owns the Hexo application and exact-content-SHA build.
- `wikip-co/public` is generated output consumed by Cloudflare Pages.

## What a “packet” is

A research packet is a structured evidence bundle produced by the scraper
before the model is allowed to reason about a source. It contains the requested
and resolved URLs, article title, DOI or PMID, authors, journal and date, study
type, abstract, extracted body, scraper backend, citation metadata, and
retrieval or consistency warnings.

It is not a network packet and it is not merely the HTML response. It is the
normalized handoff between deterministic retrieval and model judgment.

![Scraper fallback and packet validation](diagrams/rendered/scraper-packet-validation.svg)

FlareSolverr can solve many JavaScript and anti-bot challenges, but it cannot
make every publisher response trustworthy. It receives the **original article
URL**, not CAPTCHA HTML returned by an earlier scraper. Its returned page is
then validated again because it can still be a CAPTCHA, login page, rate-limit
message, generic publisher error, or content for a different article. Body
length is not evidence of success: challenge pages can be very long.

“Verify title/DOI consistency” means that enrichment metadata must describe
the same paper that was scraped. A DOI whose Crossref title materially differs
from the scraped title is rejected instead of letting the model cite one paper
while summarizing another.

## Quality contract

For files below `content/Natural Healing/`,
[`natural-healing-content-style-guide.md`](natural-healing-content-style-guide.md)
is authoritative. The near-verbatim, bullet-first style is intentionally the
baseline. The publisher does not paraphrase freely: every proposed bullet must
carry an exact source quotation, and deterministic validation checks that the
rendered bullet stays near that wording.

The general tool guide at
`research-tools/docs/research-publishing-style-guide.md` applies everywhere
else and supplies shared repository, citation, evidence, and PR rules.

![Local publisher quality gates](diagrams/rendered/local-publisher-quality-gates.svg)

Important outcomes are intentional:

- `duplicate`: the DOI/URL is already cited or an equivalent active job exists.
- `rejected`: the source is permanently unusable or evidence is insufficient.
- `needs_review`: the source may be useful, but matching or content judgment is
  not safe enough to automate.
- `retry`: a transient error should be tried again after `next_run_at`.
- `failed`: the retry budget is exhausted; diagnose it manually.
- `pr_open`: a draft PR URL was verified.

The local publisher currently appends to a confidently matched existing
article. It does not autonomously create a new article. An uncertain placement
becomes `needs_review`.

## Current iconium runtime

Observed on 2026-08-09:

| Component | State | Address or schedule | Purpose |
| --- | --- | --- | --- |
| `research-triage-ui.service` | active | local/LAN port `8765` | curate intake rows and run the legacy Codex path |
| `qwen-moe-server-q8.service` | active | `127.0.0.1:8080/v1` | local OpenAI-compatible draft/critic API |
| `research-flaresolverr` | active Podman container | `127.0.0.1:8191` | browser/anti-bot retrieval fallback |
| `research-db-backup.timer` | enabled | nightly around 03:30 | online SQLite backup and NAS integrity check |
| `research-scholar-sync.timer` | not installed | template: every 30 minutes | passive Gmail alert ingestion |
| `research-local-publisher.timer` | not installed | template: every 15 minutes | enqueue and process one queued article |

The active model was `qwen3.6-35b-a3b-q8_0-mtp` in a rootless Toolbx
`llama-rocm-7.2.4`, with a 262,144-token context, Q8 KV cache, full GPU
offload, MTP, and `-np 1`. Other Qwen/Gemma systemd model units also bind port
8080 and are mutually exclusive. The authoritative model-service
administration belongs to `~/iconium-llm-stack`; always stop the active unit
before starting another port-8080 unit.

![Local llama.cpp integration](diagrams/rendered/local-llm-stack-integration.svg)

Because the active llama server uses `-np 1`, run one publication job at a
time. A job performs a draft call and a critic call sequentially.

## First-line health checks

Run from `~/Research/research-tools` unless noted:

```bash
./agent-workflow doctor
curl --fail --silent http://127.0.0.1:8080/v1/models | jq .
curl --fail --silent http://127.0.0.1:8191/health
systemctl --user status research-triage-ui.service --no-pager
systemctl --user status research-db-backup.timer --no-pager
systemctl --user list-timers 'research-*' --all
podman ps --filter name=research-flaresolverr
```

Inspect logs without following indefinitely:

```bash
journalctl --user -u research-triage-ui.service -n 100 --no-pager
journalctl --user -u research-db-backup.service -n 100 --no-pager
journalctl --user -u qwen-moe-server-q8.service -n 100 --no-pager
```

After the optional timers are installed, use the same commands with
`research-scholar-sync.service` and `research-local-publisher.service`.

## Configuration

The important environment defaults are:

```text
GMAIL_READER_DB=~/Research/research-tools/gmail-reader/data/scholar-alerts.db
CONTENT_REPO_ROOT=~/Research/content
LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
LOCAL_LLM_MODEL=qwen3.6-35b-a3b-q8_0-mtp
```

The tracked examples and unit templates use absolute `/home/anthony/Research`
paths. Edit copied units if the workspace moves. Secrets are loaded by
`research-tools/auth-bootstrap`; do not put credentials in service templates,
committed `.env` files, packets, or job reports.

## Ad-hoc URL workflow

Always begin with a dry run:

```bash
cd ~/Research/research-tools
./agent-workflow local-publish 'https://publisher.example/paper' \
  --alert-name 'topic name'
```

The output directory contains the normalized packet, JSON report, proposed
patch, and isolated worktree. Review at least:

1. scraped title, DOI, abstract/body, and warnings;
2. selected target Markdown path and heading;
3. each bullet against its source quotation;
4. study type, species, population, dose, duration, and limitations;
5. footnote metadata and existing article formatting; and
6. the complete Git diff.

Only after that review, rerun with publication enabled:

```bash
./agent-workflow local-publish 'https://publisher.example/paper' \
  --alert-name 'topic name' --publish
```

`--publish` creates a branch and commit in an isolated worktree based on
`origin/main`, pushes it, and opens a draft PR after every gate passes. It does
not merge the PR.

## Passive database workflow

Sync recent Scholar alerts manually:

```bash
./scripts/sync-scholar-alerts
```

Use the triage UI or CLI to set candidates to `selected`. Enqueue one row by
article key or source URL, or take a bounded score-ordered slice:

```bash
./agent-workflow enqueue-local ARTICLE_KEY_OR_URL
./agent-workflow enqueue-local-backlog --status selected --min-score 12 --limit 10
```

Dry-run one job:

```bash
./agent-workflow local-worker --max-jobs 1
```

Allow one passing job to open a draft PR:

```bash
./agent-workflow local-worker --max-jobs 1 --publish
```

The queue uses atomic leases, lease expiry recovery, bounded retries, and an
append-only event history. Active-source and active-article uniqueness indexes
prevent the same candidate from being enqueued twice.

![Durable publication job lifecycle](diagrams/rendered/publication-job-lifecycle.svg)

List jobs directly:

```bash
uv run --directory gmail-reader gmail-reader \
  --db gmail-reader/data/scholar-alerts.db \
  publication-jobs --state all --limit 50
```

Useful read-only queue summary:

```bash
sqlite3 gmail-reader/data/scholar-alerts.db \
  "SELECT state, count(*) FROM publication_jobs GROUP BY state ORDER BY state;"
```

Do not set job states manually during ordinary operation. The lower-level
`set-publication-job-state` command exists for controlled recovery; first read
the job and its events, stop the worker, take a backup, and record why the state
is being changed.

### What `processed_at` means

For the local queue, `pr_open`, `duplicate`, and `rejected` mark the related
article processed. A transient retry or `needs_review` does not. `failed` is a
terminal job state but is not treated as successful content processing.

The legacy triage/Codex path marks `processed_at` only after a successful exit
that reports a draft PR URL. A zero process exit without a PR is not success.

## Database relationships and maintenance

The live system remains a local SQLite primary. PostgreSQL is a future option,
not an implemented dependency.

![Research database relationships](diagrams/rendered/research-database-schema.svg)

The core tables are:

- `messages` and `articles`: Gmail alert intake and triage candidates;
- `papers` and `article_papers`: canonical paper identity and links back to
  occurrences in alerts;
- `article_jobs` and `article_job_items`: legacy Codex UI jobs;
- `publication_jobs` and `publication_job_events`: local-model durable queue
  and audit history.

Historical article-to-paper linking is dry-run by default:

```bash
uv run --directory gmail-reader gmail-reader \
  --db gmail-reader/data/scholar-alerts.db \
  backfill-paper-keys --status selected --limit 1000
```

Before applying any bounded batch, run and verify a backup, review the dry-run
counts, and then add `--apply`. Do not run an unbounded backfill casually.

The enabled backup service uses SQLite's online backup API, writes a dated NAS
snapshot plus `scholar-alerts-latest.db`, runs `PRAGMA integrity_check`, reports
article/message counts, and retains the configured number of dated snapshots.

Manual backup and verification:

```bash
./gmail-reader/backup-db.sh
systemctl --user start research-db-backup.service
journalctl --user -u research-db-backup.service -n 50 --no-pager
```

The default NAS destination is
`/mnt/naspi5/content-agent-backups/gmail-reader`. Keep a single active writer
against the local SQLite primary; do not place the live database itself on a
network filesystem.

## Installing the passive timers

The timer templates are intentionally not installed by the implementation.
Complete dry-run pilots and review their patches before activation.

1. Confirm the llama endpoint, FlareSolverr, Gmail credentials, GitHub CLI,
   content checkout, and backup are healthy.
2. Inspect `systemd/research-local-publisher.service`. The tracked template
   includes `--publish`, so enabling it authorizes draft-PR creation.
3. Copy the templates and reload systemd:

```bash
mkdir -p ~/.config/systemd/user
cp systemd/research-scholar-sync.service systemd/research-scholar-sync.timer \
  systemd/research-local-publisher.service systemd/research-local-publisher.timer \
  ~/.config/systemd/user/
systemctl --user daemon-reload
```

4. Test each oneshot manually before enabling its timer:

```bash
systemctl --user start research-scholar-sync.service
systemctl --user status research-scholar-sync.service --no-pager
systemctl --user start research-local-publisher.service
systemctl --user status research-local-publisher.service --no-pager
```

5. Enable schedules only after output review:

```bash
systemctl --user enable --now research-scholar-sync.timer
systemctl --user enable --now research-local-publisher.timer
systemctl --user list-timers 'research-*' --all
```

Pause unattended intake or publishing without deleting state:

```bash
systemctl --user disable --now research-scholar-sync.timer
systemctl --user disable --now research-local-publisher.timer
```

![Operator services and schedules](diagrams/rendered/operator-services-and-schedules.svg)

## Research tools command ownership

`agent-workflow` is the stable human/agent entrypoint. It delegates to the
package that owns each operation rather than duplicating implementation.

![Research Tools command map](diagrams/rendered/research-tools-command-map.svg)

Use command-specific help as the source of truth for flags:

```bash
./agent-workflow --help
./agent-workflow local-publish --help
./agent-workflow local-worker --help
uv run --directory gmail-reader gmail-reader --help
```

## Draft PR to live site

After a local publisher draft PR is reviewed and merged into `content/main`,
the content repository dispatches the exact content commit SHA to `wikip.co`.
The site workflow prepares a plain Markdown tree, builds Hexo, commits generated
output to `wikip-co/public`, publishes the Docker image, and lets Cloudflare
Pages deploy the generated repository.

See [`content-publishing-runbook.md`](content-publishing-runbook.md) for build
and deployment operations. Generated HTML is never an authoring target.

## Troubleshooting decisions

| Symptom | Check | Safe response |
| --- | --- | --- |
| llama request fails or returns no final JSON | model unit logs, `/v1/models`, selected model ID | stop queue timer; restore the expected model service; retry one dry-run job |
| page is a robot/CAPTCHA/error page | packet warnings, scraper backend, Flare logs | do not override the packet gate; fix retrieval or use another authoritative source |
| FlareSolverr says success but packet is rejected | returned title/body and fatal-page markers | treat Flare success as transport success only; allow browser fallback or reject |
| DOI and title mismatch | scraped title, DOI source, Crossref title | reject and correct source identity; never force the DOI |
| job remains leased after interruption | lease owner, expiry, events, service logs | wait for expiry or perform a documented recovery while worker is stopped |
| repeated `retry` becomes `failed` | event error history and attempt count | repair the underlying dependency, then explicitly re-enqueue rather than hiding history |
| `needs_review` | target scores, headings, study design, critic issues | choose a target or edit manually; do not coerce an uncertain automated append |
| clean process exit but no PR | report status and `pr_url` | keep unprocessed; a verified PR URL is required |
| backup fails | NAS mount, free space, backup log, integrity output | stop new queue work if no recent good backup; restore storage first |
| SQLite lock contention | active services and writers | keep one publisher worker; do not copy the live DB while writers run |

## Validation after changes

From the coordinator:

```bash
bash -n workspace
./workspace validate
./workspace status
```

From `research-tools`:

```bash
bash -n agent-workflow scripts/sync-scholar-alerts
uv run pytest -q
./agent-workflow doctor
```

From `wikip.co` when build behavior changes:

```bash
./scripts/build-site
```

Regenerate architecture artifacts after changing system behavior:

```bash
docs/diagrams/render-diagrams
```

Commit each YAML specification together with its SVG and PNG render, and inspect
PNG output at full resolution.

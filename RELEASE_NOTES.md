# Research workspace — release notes & handoff

Living notes for the flat workspace coordinator at `~/Research` (`wikip-co/Research`).
Covers cross-repo / host-level changes and points into repository-specific notes.

If you are a Hermes (or human) picking up this stack: **start here**, then open the linked child notes before changing production behavior.

| | |
|---|---|
| **Primary runtime host** | `iconium` (`10.32.25.177` / `iconium.lan`) |
| **Workspace path** | `~/Research` |
| **GitHub coordinator** | `wikip-co/Research` · branch `main` |
| **Triage UI** | http://iconium.lan:8765 |
| **Not primary** | ser9 research services were cut over ~Aug 2026; do not revive without explicit direction |

---

## Workspace map

| Path | Repo | Role |
|------|------|------|
| `research-tools/` | `wikip-co/research-tools` | Intake, SQLite DB, triage UI, scraper, wiki-automation, agent-workflow |
| `content/` | `wikip-co/content` | Markdown source of truth for wiki articles |
| `wikip.co/` | `wikip-co/wikip.co` | Hexo site build + build-time content/public fetch |
| `docs/` | (in this repo) | Cross-cutting runbooks, architecture, and agent guidelines |
| `README.md` | (this repo) | Clone/sync, repository boundaries, flow overview |

**Detail for tools/runtime:** [`wikip-co/research-tools` release notes](https://github.com/wikip-co/research-tools/blob/main/RELEASE_NOTES.md)
**Workspace orientation:** [`README.md`](./README.md)
**DB migration notes:** [`docs/database-architecture-and-migration.md`](./docs/database-architecture-and-migration.md)
**Production operations:** [`docs/research-production-operations.md`](./docs/research-production-operations.md)

### Pipeline (reminder)

```text
Gmail / Google Scholar alerts
  -> research-tools/gmail-reader
  -> SQLite research intake DB
  -> validated packet + DOI/title identity gate
  -> local llama.cpp draft + critic + deterministic gates
  -> isolated content worktree + draft PR
  -> wikip.co Hexo build
  -> wikip-co/public / Cloudflare Pages
```

---

## Managed repositories

`workspace-repos.tsv` records repository names and default branches, not commit pointers. `./workspace sync` clones missing repositories and fast-forwards clean checkouts that are already on their declared branch.

Check live state:

```bash
cd ~/Research
./workspace status
```

**Rule:** day-to-day commits go in the repository that owns the files. Research never records child commit pointers.

### One-time migration for existing hosts

Existing submodule worktrees keep pointing into `Research/.git/modules` until they are explicitly detached. `./workspace sync` intentionally does not perform this structural migration.

After the flat-layout changes are available on the host:

```bash
cd ~/Research
./workspace migrate --check
./workspace migrate
./workspace verify-layout
```

The migration preserves dirty state in the three top-level repositories and refuses to detach the former nested site repositories unless they are clean and fully pushed. It stores recoverable legacy metadata under `.git/legacy-submodule-backups/`.

---

## Host production layout (iconium)

```
~/Research/                          # flat coordinator + standalone checkouts
~/Research/research-tools/           # tools + UI + agent-workflow
~/Research/research-tools/.env       # host secrets/paths (never commit)
~/Research/research-tools/gmail-reader/data/scholar-alerts.db
~/Research/content/                  # CONTENT_REPO_ROOT for production

FlareSolverr:  http://127.0.0.1:8191/v1
NAS (NFS):     /mnt/naspi5  (backups), /mnt/data1
DB backups:    /mnt/naspi5/content-agent-backups/gmail-reader/
               timer research-db-backup ~03:30 (user systemd on iconium)
```

### Typical user systemd units (iconium)

| Unit | Role |
|------|------|
| `research-triage-ui.service` | LAN triage web UI |
| `research-db-backup.timer` | Nightly SQLite → NAS |
| `container-research-flaresolverr.service` | FlareSolverr (see footnote) |
| `hermes-gateway.service` | Iconium Hermes gateway |
| `qwen-moe-server-q8.service` | Active Qwen3.6 35B A3B Q8_0 llama.cpp API on port 8080 |
| `research-scholar-sync.timer` | Tracked template; not installed/enabled as observed 2026-08-09 |
| `research-local-publisher.timer` | Tracked template; not installed/enabled as observed 2026-08-09 |

---

## What changed recently (cross-cutting)

### 2026-08-09 — guarded local-model production path

- Added ad-hoc and durable SQLite-queue publication through the local llama.cpp
  model, including sequential structured draft and critic calls.
- Hardened the retrieval contract: bot/CAPTCHA/login/error packets fail
  regardless of length, FlareSolverr receives the original URL, its result is
  revalidated, and DOI/title enrichment must identify the same paper.
- Added hybrid content matching, exact-source-quote and near-verbatim Natural
  Healing gates, study-design/claim validation, Markdown rendering checks, and
  Git-scope validation.
- Added isolated `origin/main` worktrees and optional draft PR creation; the
  path never auto-merges.
- Added `publication_jobs` and `publication_job_events` with atomic leases,
  bounded retries, durable outcomes, and active-job deduplication.
- Added Scholar-sync and local-publisher service/timer templates. They were not
  installed or enabled; production activation remains an operator decision
  after pilot review.
- Preserved `docs/natural-healing-content-style-guide.md` unchanged as the
  authoritative near-verbatim style baseline.
- Expanded the architecture gallery from 11 to 19 diagrams and added the
  canonical operator guide linked above.

### 2026-08-03 — operator handoff

- **Workspace migration:** replace top-level and nested submodules with manifest-driven standalone checkouts and build-time site inputs.
- **Existing-host migration:** add `./workspace migrate` and `verify-layout`; the current workstation was detached successfully without changing any in-progress repository state.
- **Site CI:** `wikip.co` owns its build/deploy workflow and fetches exact content plus generated-output repositories explicitly.
- **Content CI:** `content` dispatches only to `wikip.co`; `anthonyrussano.com` is now independent.
- **Agent guidance:** move the Natural Healing content style guide out of publishable content and into `Research/docs/`.
- **Documentation:** centralize the site publishing runbook and architecture diagrams in `Research/docs/`.
- **Prior coordinator snapshot:** `research-tools` was last recorded at `3c6cab4` before gitlinks were removed.
- **research-tools `3c6cab4`:** child `RELEASE_NOTES.md` + README pointer (tool-level detail).
- **research-tools `9d794a8`:** safer live SQLite backup (`sqlite3 .backup`, integrity check, retention).
- **research-tools `b9fd730`:** `agent-workflow` dotenv only fills **unset** vars; tests isolate `CONTENT_REPO_ROOT` so production `.env` no longer breaks managed-clone tests.
- **Git hygiene:** iconium had briefly run scp’d fix files ahead of pull; cleaned to fast-forward clean `main`. Prefer commit/push/pull over long-lived scp overlays.
- **ser9:** not the research primary; iconium owns runtime.

### Earlier on `research-tools` (still relevant)

- `4f2f721` — publisher PDF gate URLs → HTML before scrape  
- `9dd2fb4` — FlareSolverr Cloudflare fallback for web-scraper  
- Triage UI + Codex job log streaming (see child README / git log)

### `content` / `wikip.co`

`content` remains the markdown source and dispatches its exact SHA. `wikip.co` fetches it at build time and publishes generated output through a separate temporary checkout of `wikip-co/public`.

---

## Known footnote

FlareSolverr may answer on `:8191` while `container-research-flaresolverr.service` reports **inactive**. Non-blocking if the port is healthy; follow up so reboot ownership is clear.

```bash
curl -sS -m 3 http://127.0.0.1:8191/v1 \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"sessions.list"}'
```

---

## Pickup checklist (new Hermes / operator)

1. `cd ~/Research && git status -sb && git pull --ff-only && ./workspace sync`
2. Read **this file**, then the [`research-tools` release notes](https://github.com/wikip-co/research-tools/blob/main/RELEASE_NOTES.md)
3. Run `./workspace verify-layout`. If it fails on legacy gitfiles, run `./workspace migrate --check` and then `./workspace migrate`.
4. Confirm services:  
   `systemctl --user status research-triage-ui research-db-backup.timer`
5. Confirm mounts: `mountpoint /mnt/naspi5 /mnt/data1`
6. Confirm Flare health (curl above)
7. Optional smoke:  
   `cd research-tools && python3 -m unittest tests.test_agent_workflow -v`
8. Only then take product work (triage, scrape, Scholar intake, content PRs, publish)

### Do / don’t

| Do | Don’t |
|----|--------|
| Commit tools/content/site changes in the owning repo | Leave production on uncommitted scp overlays |
| Update this file when host topology or repository membership changes | Set empty/wrong `CONTENT_REPO_ROOT` to “fix” tests |
| Keep secrets in host `.env` / Vault | Commit `.env` or tokens into any repo |
| Use iconium as research primary | Assume ser9 still runs production research services |

---

## Changelog (coordinator)

### 2026-08-03
- Replace submodule gitlinks with `workspace-repos.tsv` and `./workspace`
- Add an explicit, status-preserving migration for existing `.git/modules` workspaces
- Add workspace-level `RELEASE_NOTES.md` for multi-submodule handoff
- Bump `research-tools` submodule pin to `3c6cab4`
- Point root `README.md` at this file

### Prior workspace history (see `git log`)
- Pins for FlareSolverr scraper support, live job logs, DB architecture doc, etc.

---

*When you change repository membership, host cutover, or anything another agent needs across repos, append here first — then add deeper detail in the owning repository when appropriate.*

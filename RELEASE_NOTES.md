# Research workspace — release notes & handoff

Living notes for the **superproject** at `~/Research` (`wikip-co/Research`).  
Covers cross-repo / host-level changes and points into submodule-specific notes.

If you are a Hermes (or human) picking up this stack: **start here**, then open the linked child notes before changing production behavior.

| | |
|---|---|
| **Primary runtime host** | `iconium` (`10.32.25.177` / `iconium.lan`) |
| **Workspace path** | `~/Research` |
| **GitHub superproject** | `wikip-co/Research` · branch `main` |
| **Triage UI** | http://iconium.lan:8765 |
| **Not primary** | ser9 research services were cut over ~Aug 2026; do not revive without explicit direction |

---

## Workspace map

| Path | Repo | Role |
|------|------|------|
| `research-tools/` | `wikip-co/research-tools` | Intake, SQLite DB, triage UI, scraper, wiki-automation, agent-workflow |
| `content/` | `wikip-co/content` | Markdown source of truth for wiki articles |
| `wikip.co/` | `wikip-co/wikip.co` | Hexo site build + publish (nested: `_posts` → content, `public` → static) |
| `docs/` | (in this repo) | Cross-cutting workspace docs (e.g. DB architecture plan) |
| `README.md` | (this repo) | Clone/sync, submodule rules, flow overview |

**Detail for tools/runtime:** [`research-tools/RELEASE_NOTES.md`](./research-tools/RELEASE_NOTES.md)  
**Workspace orientation:** [`README.md`](./README.md)  
**DB migration notes:** [`docs/database-architecture-and-migration.md`](./docs/database-architecture-and-migration.md)

### Pipeline (reminder)

```text
Gmail / Google Scholar alerts
  -> research-tools/gmail-reader
  -> SQLite research intake DB
  -> research-tools/web-scraper + wiki-automation
  -> content markdown (PR)
  -> wikip.co Hexo build
  -> wikip-co/public / Cloudflare Pages
```

---

## Pinned submodule commits (workspace `main`)

Update this table whenever you intentionally bump workspace pins.

| Submodule | Pin (short) | Notes |
|-----------|-------------|--------|
| `research-tools` | `3c6cab4` | Tools handoff notes, dotenv/managed-clone fix, safer DB backup, Flare/PDF scrape work |
| `content` | `8be79c2` | Unchanged in this handoff snapshot |
| `wikip.co` | `c0972dd` | Unchanged in this handoff snapshot |

Check live pins:

```bash
cd ~/Research
git submodule status
# leading "+" means checked-out submodule commit differs from the pin recorded by this repo
```

**Rule:** day-to-day commits go in the **child** repo. Bump and commit the superproject pointer only when you want new clones / iconium workspace to track that child HEAD.

---

## Host production layout (iconium)

```
~/Research/                          # this superproject
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

---

## What changed recently (cross-cutting)

### 2026-08-03 — operator handoff

- **Superproject:** this `RELEASE_NOTES.md`; pin `research-tools` → `3c6cab4`.
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

No operator-critical pin moves in this handoff window. Recent `content` work is normal article/guide PRs; `wikip.co` has deploy/CI diagram docs. Bump pins when you intentionally ship those into the workspace snapshot.

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

1. `cd ~/Research && git status -sb && git pull --ff-only`
2. Read **this file**, then [`research-tools/RELEASE_NOTES.md`](./research-tools/RELEASE_NOTES.md)
3. Align tools checkout with intent:
   ```bash
   # either: match workspace pin
   git submodule update --init --recursive
   # or: track tools main explicitly (then bump pin when stable)
   cd research-tools && git pull --ff-only origin main
   ```
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
| Commit tools/content/site changes in the **child** repo | Leave production on uncommitted scp overlays |
| Update this file when host topology or pins change | Set empty/wrong `CONTENT_REPO_ROOT` to “fix” tests |
| Keep secrets in host `.env` / Vault | Commit `.env` or tokens into any repo |
| Use iconium as research primary | Assume ser9 still runs production research services |

---

## Changelog (superproject)

### 2026-08-03
- Add workspace-level `RELEASE_NOTES.md` for multi-submodule handoff
- Bump `research-tools` submodule pin to `3c6cab4`
- Point root `README.md` at this file

### Prior workspace history (see `git log`)
- Pins for FlareSolverr scraper support, live job logs, DB architecture doc, etc.

---

*When you change submodule pins, host cutover, or anything another agent needs across repos, append here first — then deeper detail in the child `RELEASE_NOTES` if the change is tools-only.*

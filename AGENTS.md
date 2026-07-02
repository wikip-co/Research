# AGENTS.md

This repository (`wikip-co/Research`) is a thin Git superproject that wires together three child repos as submodules:

- `research-tools` — Python `uv` workspace with the agent toolchain + a LAN web "triage" UI.
- `content` — markdown source of truth for wiki articles.
- `wikip.co` — Hexo static site that builds the markdown from `content`.

See `README.md` for the full architecture and publishing flow.

## Cursor Cloud specific instructions

### Environment shape (already provisioned by the startup update script)

The startup update script initializes submodules, installs `uv`, runs `uv sync --all-packages` for `research-tools`, and runs `npm ci` for `wikip.co/site`. You normally do NOT need to re-run those by hand.

- `uv` is installed at `~/.local/bin/uv`. If `uv` is not on your `PATH`, either call it by full path or run `export PATH="$HOME/.local/bin:$PATH"`.
- Submodule remotes in `.gitmodules` use SSH URLs (`git@github.com:...`) but the cloud token is HTTPS-only. Submodule operations therefore need an HTTPS rewrite + the `gh` credential helper, e.g.:
  `gh auth setup-git`
  `git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init --recursive`
- `wikip.co` almost always shows as dirty/modified in `git status` because building Hexo writes generated files into its nested `public` submodule. This is expected — do NOT commit submodule pointer bumps unless that is the actual task.

### research-tools (Python uv workspace)

- Run commands from the `research-tools/` directory (or pass `--project research-tools` / `--directory <pkg>` to `uv`).
- Tests / "lint": there is no separate linter; CI (`research-tools/.github/workflows/ci.yml`) only runs `make test`. Run all tests with `make test` (wraps `uv run python -m unittest discover` across `tests`, `gmail-reader`, `web-scraper`, `wiki-automation`, `image-upload`).
- Health check: `./agent-workflow doctor` (JSON). The full agent workflow expects external services (`gws`/Gmail, Vault, Cloudinary, Codex) that are NOT available in the cloud VM, so those commands will fail without secrets — this is expected and not a setup bug.

#### Triage web UI (the runnable app)

- Start with: `GMAIL_READER_DB="$PWD/gmail-reader/data/scholar-alerts.db" ./agent-workflow triage-ui --port 8765` from `research-tools/` (binds `0.0.0.0:8765`).
- The DB is created automatically (`ensure_db`) on first start; it does NOT need Gmail/Vault to run. The production DB normally comes from a ~1.3 GB NAS backup that is not reachable here, so for local testing seed a few rows directly into the `articles`/`messages` tables of the SQLite file.
- The default index view filters out `review` rows; use `?status=review` (or `?status=selected`, etc.) to see seeded rows. Core action: select rows + "Mark selected/rejected/..." which updates row status in the DB.

### wikip.co (Hexo static site)

- Build: `NODE_OPTIONS=--max-old-space-size=5168 npm --prefix site run build` (run from `wikip.co/`; ~2 min, generates into the `public` submodule).
- Dev server: `npm --prefix site run server` (serves `http://localhost:4000`). The `_posts` markdown and `public` output are nested submodules, so a recursive submodule init is required before building.

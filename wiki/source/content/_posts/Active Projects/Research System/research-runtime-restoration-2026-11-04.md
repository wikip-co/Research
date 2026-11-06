---
title: Research Runtime Restoration 2026-11-04
description: Iconium workspace and model restoration, NAS database recovery, scraper DOI repair, and the remaining editorial and credential gates.
status: Runtime restored; review pending
tags:
  - Automation
  - Hardware
  - Omarchy
  - Troubleshooting
---

> Imported as a dated restoration milestone from the [central wiki record](https://agent.wikip.co/natural-healing-research-host-restoration-2026-11-04/). It preserves the measured session; this project wiki owns future Research-specific updates. The later architecture review is in {% post_link "Research Architecture and Statechart Atlas" %}.


## Outcome and boundaries

**Verified 2026-11-04, America/Los_Angeles:** the Research workspace, a Qwen3.8 27B Q8 Vulkan service, FlareSolverr and the local triage UI are operational on Iconium. The surviving NAS database was copied to local disk and passed full SQLite integrity validation. A real-paper publisher dry run completed its model call and deterministic checks, then stopped at **`needs_review` / `deterministic_quality_gate_failed`**. No research content was published, no gate was bypassed, and no scheduled intake/publisher was enabled.

This is a runtime restoration and diagnostic milestone, not approval of a redesign option or proof of editorial correctness. {% post_link "Research System Overview" %} owns project decisions and next steps. [Iconium Local Inference and Memory Diagnostics 2026-11-04](https://agent.wikip.co/iconium-local-inference-and-memory-diagnostics-2026-11-04/) owns the earlier small-model test; [AMD Strix Halo GPU Memory for llama.cpp: Fixed VRAM versus GTT](https://agent.wikip.co/amd-strix-halo-gpu-memory-for-llama-cpp-fixed-vram-versus-gtt/) owns memory tuning. BIOS VRAM remains 32 GiB; no kernel memory, BIOS, IOMMU or authentication-policy change was made.

## Later inference measurements

The 32 GiB reservation and b12119 service below describe the 2026-11-04 restoration. The owner later increased the BIOS reservation to 96 GiB. {% post_link "Research Inference Tuning with a 96 GiB GPU Reservation" %} records the 2026-11-06 capacity tests, stronger Flash Next model, full-precision comparisons, and selected service settings.

## Workspace and dependencies

The coordinator was cloned over HTTPS to `~/Projects/Research`, then its supported helper cloned three independent repositories:

```bash
mkdir -p "$HOME/Projects"
git clone https://github.com/wikip-co/Research.git "$HOME/Projects/Research"
cd "$HOME/Projects/Research"
RESEARCH_GIT_PROTOCOL=https ./workspace sync
./workspace validate
./workspace verify-layout
./workspace status
```

There are no new submodules/gitlinks. `research-tools` owns tooling; `content` owns articles; `wikip.co` owns the site. Original repository documents were left intact. The local `LOCAL_SETUP.md` records host-specific operations and is excluded through `.git/info/exclude`.

| Component | Installed configuration / finding |
| --- | --- |
| Host | Omarchy 4.0.6, kernel `7.2.8-9-omarchy`, Radeon 8060S (`gfx1151`), Mesa 26.2.5 |
| Python | uv-managed CPython 3.12.15, frozen workspace dependencies in `research-tools/.venv` |
| Python failure | Default host Python 3.14 could not install pinned `onnxruntime==1.20.1`; selecting Python 3.12 resolved it without changing the lockfile |
| Node | Existing mise Node 24.22.1 selected with an ignored local `.mise.toml` |
| Google Workspace CLI | `@googleworkspace/cli` 0.22.5, installed in the Node 24 environment; credentials remain absent |
| Browser CLI | `agent-browser` 0.23.0, matching the tooling container's version |
| Browser runtimes | Playwright/Patchright Chromium 145 (build 1208) and agent-browser Chrome 157 downloaded; both browser engines launched successfully |
| Native utilities | Existing Git, gh, uv, jq, rsync, PDF/OCR tools; Vault 2.1.1 and nfs-utils 3.1.1 installed with noninteractive sudo |
| Site | Node 24 build passed and generated 4,471 files; output remains ignored build material |

Relevant installation commands, with the workspace already cloned:

```bash
cd "$HOME/Projects/Research/research-tools"
uv sync --all-packages --frozen --python 3.12
# Keep an explicit local Python 3.12 selection for subsequent uv commands.
uv run --python 3.12 playwright install chromium
uv run --python 3.12 patchright install chromium
mise exec node@24 -- npm install --global \
  --allow-scripts=@googleworkspace/cli,agent-browser \
  @googleworkspace/cli@0.22.5 agent-browser@0.23.0
mise exec node@24 -- agent-browser install
sudo -n omarchy pkg add vault nfs-utils
```

npm initially installed the CLI packages while withholding their postinstall scripts; reinstalling with the explicit package-specific `--allow-scripts` option completed their binary setup. No global script-policy change was needed. Browser installers warned that Arch/Omarchy was unsupported and used compatible fallback downloads; actual browser launch tests passed.

The ignored `research-tools/.env` is mode 0600 and contains local paths/endpoints, not credentials. Its important values are `CONTENT_REPO_ROOT` pointing to the sibling content checkout, `GMAIL_READER_DB` pointing to the restored local file, `LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1`, `LOCAL_LLM_MODEL=qwen3.8-27b-q8_0`, and `FLARESOLVERR_URL=http://127.0.0.1:8191/v1`. The local interpreter pin and mise config are excluded from Git. `mise exec -- COMMAND` resolves the Node 24 CLI tools when the current shell has not activated the local version; merely finding a mise shim on PATH does not establish that a tool can run.

## Model installation and service

llama.cpp **b12119**, build `6f1e65437`, was extracted from its upstream Ubuntu Vulkan x64 release archive into `~/.local/opt/llama.cpp/llama-b12119`. `llama-cli`, `llama-server` and `llama-bench` have launchers under `~/.local/bin`. The earlier test copy was retained separately.

The model is `unsloth/Qwen3.8-27B-GGUF`, file `Qwen3.8-27B-Q8_0.gguf`, pinned to repository revision `4ca720788d1e01f1bff70c033e0d0028fd02e502`. Downloaded size: **29,047,086,048 bytes**. Local SHA-256 matched the upstream LFS fingerprint:

```text
a680f44a06920e5d689774823782006aa3acc8db95750323373b24139b67e348
```

It is stored in `~/Models/Qwen3.8-27B/`. The user unit `~/.config/systemd/user/research-llm.service` runs the equivalent of:

```bash
"$HOME/.local/bin/llama-server" \
  -m "$HOME/Models/Qwen3.8-27B/Qwen3.8-27B-Q8_0.gguf" \
  --alias qwen3.8-27b-q8_0 --host 127.0.0.1 --port 8080 \
  -ngl 99 -c 32768 -np 1 -fa on -ctk q8_0 -ctv q8_0 --reasoning off
```

This is **Vulkan, 32K context, one slot, Q8 KV cache, reasoning off, no MTP**. It does not reproduce the historical 262K ROCm/MTP setup. Unused next-token/MTP tensor warnings were logged; the model subsequently loaded and responded normally. No ROCm/HIP inference was validated during this restoration.

Research's `LocalLLMClient` correctly extracted a synthetic participant count (40), duration (6 weeks) and exact supporting quote in **5.85 seconds**. After that request, driver counters showed approximately **27.85 GiB fixed VRAM** and **1.48 GiB GTT** in use; swap use was zero. These are snapshots, not peak measurements or a maximum-memory allocation test. The service's cgroup memory figure does not include the full GPU allocation.

## Services and operator checks

| Component | Verified state | Restart / persistence boundary |
| --- | --- | --- |
| `research-llm.service` | Active user unit; localhost `8080/v1`; health and model-list checks passed | Started manually; disabled for automatic login start |
| `research-triage-ui.service` | Active user unit; localhost `8765`; HTTP 200 after restore | Started manually; disabled for automatic login start |
| `research-flaresolverr` | Docker container, FlareSolverr 3.5.2; localhost `8191`; `/health` and `/` passed | Local ignored Compose file uses `restart: unless-stopped` |
| NAS mount | NFSv4.2 read-only at `/mnt/naspi5` | Transient systemd mount; no fstab/boot automount added |
| Scholar sync / publisher timers | Not installed or enabled | No unattended intake, queue processing or draft-PR creation |

{% site_link artifacts/research-runtime-restoration-2026-11-04/runtime-config-examples.txt "Sanitized installed user units and Compose configuration" %} preserves the service definitions. Replace `ACCOUNT_NAME` and review paths before use; do not copy a host-specific unit blindly.

FlareSolverr's local Compose definition is `research-tools/runtime/flaresolverr.compose.yml`. It binds `127.0.0.1:8191:8191`, sets `LOG_HTML=false`, and uses `ghcr.io/flaresolverr/flaresolverr:latest`. The verified image ID is recorded in the evidence artifact; the mutable tag is not a version guarantee. The account was not added to the privileged Docker group.

```bash
systemctl --user start research-llm.service research-triage-ui.service
systemctl --user status research-llm.service research-triage-ui.service
journalctl --user -u research-llm.service -n 50 --no-pager
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/v1/models
curl --fail http://127.0.0.1:8191/health
curl --fail http://127.0.0.1:8765/ -o /dev/null
```

The triage unit loads the local `.env`, uses the current workspace path, and includes Node 24 in PATH. It was started only after database recovery. Stop either user unit with `systemctl --user stop UNIT_NAME`; there is no need to enable it merely to run a manual test.

## NAS recovery and authentication correction

The user chose restoration rather than rebuilding the backlog. The NAS export `naspi5.lan:/mnt/raid5` was mounted read-only:

```bash
sudo -n systemd-mount --type=nfs --options=ro,nosuid,nodev --collect \
  naspi5.lan:/mnt/raid5 /mnt/naspi5
findmnt /mnt/naspi5
```

Source: `/mnt/naspi5/content-agent-backups/gmail-reader/scholar-alerts-latest.db`, **1,330,507,776 bytes**, timestamp **2026-10-26 03:31** as displayed on the host. It was copied to a temporary file on local disk, chmod 0600, opened read-only for a full `PRAGMA integrity_check`, and installed at `research-tools/runtime/gmail-reader/scholar-alerts.db` only after the result was `ok`. No pre-existing local database was overwritten. The original NAS snapshot is unchanged; the live database stays local. Integrity validation establishes structural consistency, not completeness or freshness of the backlog relative to events after that snapshot. Raw database contents are not publication artifacts.

Earlier package/restore steps stalled because `pkexec` used Polkit authentication. A later check established that **passwordless sudo already worked**: `sudo -n true` succeeded and `sudo -n -l` showed `(ALL : ALL) NOPASSWD: ALL`. The installation and mount then completed with `sudo -n`, without changing sudoers or Polkit. A stale helper from the earlier prompt was terminated. The earlier "awaiting administrator authentication" handoff is superseded by this completed recovery. Reusable diagnostic guidance is in [Arch and Omarchy Fundamentals](https://agent.wikip.co/arch-and-omarchy-fundamentals/).

## Scraper failure and local repair

The first live scrape of [the Tualang/Manuka honey review](https://pmc.ncbi.nlm.nih.gov/articles/PMC3743976/) failed with `doi_title_mismatch`. The page had no citation DOI, but the scraper's raw-HTML fallback selected **a cited reference's DOI**, then Crossref returned that other paper's title. This was an identity-extraction defect, not evidence that the target review was invalid.

In `research-tools`, local branch `fix/iconium-local-runtime` changes `web-scraper/main.py` to avoid inferring article identity from arbitrary raw HTML or body citations and to exclude bibliography sections before reading DOI-labelled elements. Explicit metadata and URL DOI extraction remain available, with conservative title-based enrichment for missing identifiers. Two regression tests cover reference-only DOIs and body-citation inference. The same real page then scraped successfully, yielding about 64,000 characters of body text without the unrelated DOI.

**Local only:** two tooling files are modified, uncommitted and unpushed. This wiki publication does not merge that fix into `research-tools/main`. {% site_link artifacts/research-runtime-restoration-2026-11-04/scraper-doi-fix.patch.txt "Reviewable local scraper patch" %} preserves the tested changes as a zero-context diff against tooling commit `386d9619c4de4e860b61f19826232dbc341ec4f5`. Review and run its tests before applying elsewhere; use `git apply --unidiff-zero --check PATCH_FILE` for a preflight on the matching clean base. It is not a general proof that every publisher's DOI handling is correct.

## Real-paper dry run and validation limits

The full publisher used a **separate diagnostic SQLite database**, not the restored production file:

```bash
cd "$HOME/Projects/Research/research-tools"
mkdir -p runtime/diagnostics
GMAIL_READER_DB="$PWD/runtime/diagnostics/pipeline-smoke.db" \
  mise exec -- ./agent-workflow local-publish \
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3743976/ \
  --domain 'Natural Healing' --output-dir "$PWD/out/host-setup-smoke"
```

Scraping, content matching, the single model call and deterministic validation completed. The CLI returned `ok: true`, but the workflow status was **`needs_review`**, reason **`deterministic_quality_gate_failed`**, publication outcome **`not_published`**. Command completion is not editorial acceptance.

The one model call used **10,031 prompt tokens + 1,147 completion tokens**, finished normally with `finish_reason=stop` in **175.274 seconds**, and stayed below its 6,000-token completion cap. Total workflow time was **181.198 seconds**. Server logs showed approximately **7.6 generated tokens/s** during this request; this single request is not a sustained performance benchmark.

The validators flagged entity support for all eight proposed bullets, plus section-summary text, entity support, quotation and section placement. No patch or PR was published. These diagnostics need manual comparison of the draft, quoted passages, target pages and validator logic; this run alone does not isolate model quality, prompt design or false-positive validation as the cause. Do not bypass the gates to call the restoration successful.

The local report is under `research-tools/out/host-setup-smoke/runs/20261104T232714.461325Z-pmc3743976-79482b9591/report.json`. {% site_link artifacts/research-runtime-restoration-2026-11-04/restoration-evidence.json "Sanitized restoration and dry-run evidence" %} retains versions, repository revisions, timings and gate codes. It was selected from terminal checks and that report; raw source packets, prompts, draft prose, mail records, database contents and credentials are excluded.

Tests passed: root tooling **2**, Gmail **20**, scraper **14**, publisher **100**, image upload **1** (**137 total**, including two new regression tests). Coordinator shell/layout checks and `git diff --check` passed. The Hexo build produced 4,471 files. These results establish the tested paths, not every external integration or future unattended run.

## Remaining work

- Restore or re-establish Google Workspace and Cloudinary credentials. GWS reported no client config, saved credentials or token cache; no local Vault token was found. Vault's HTTPS health endpoint was initialized/unsealed, which does not establish authenticated secret access.
- Review and publish the local scraper fix through its owning repository's workflow; it is not yet available in a fresh clone.
- Investigate the dry-run gate failures with the retained report before another full drafting attempt. Re-run a bounded test after any model, prompt or validator change.
- Decide on startup policy, persistent NAS access and database backups. Manual user units and a transient read-only mount are the verified state; no replacement nightly backup timer was installed.
- Revisit HIP versus Vulkan, loading modes, larger contexts and memory tuning separately. The existing 32 GiB BIOS reservation was sufficient for these tests, so no tuning was required to establish this baseline.
- Complete the project's editorial/redesign decisions and sustained workload qualification before enabling any unattended publisher. This session does not resolve the historical Iconium reset fault or approve research-content auto-merging.

## Sources

- [Research coordinator](https://github.com/wikip-co/Research), [research-tools](https://github.com/wikip-co/research-tools), [content](https://github.com/wikip-co/content), [site](https://github.com/wikip-co/wikip.co): repository instructions, manifests, operations guide, actual runtime code and tests.
- [llama.cpp b12119 release](https://github.com/ggml-org/llama.cpp/releases/tag/b12119).
- [Pinned Qwen3.8 GGUF revision](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/tree/4ca720788d1e01f1bff70c033e0d0028fd02e502).
- Local service/unit inspections, health requests, package inventory, sudo policy check, read-only NFS mount, SQLite integrity result and retained publisher report, all dated 2026-11-04.

## Later source-history handoff

The earlier local-only tooling status above is historical: the tested DOI repair was subsequently committed as `9bb79a8` and pushed on `fix/iconium-local-runtime` in research-tools. It subsequently merged through research-tools PR #4 on 2026-11-04 (America/Los_Angeles); queue fixes were not implemented. The project wiki is now tracked directly in Research and served locally at localhost:4010.

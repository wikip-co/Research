# Research Project Wiki

This tracked folder is the knowledge base for the Research workspace. Start at
[Research System Overview](<source/content/_posts/Active Projects/Research System/research-system-overview.md>).
The atlas contains fourteen architecture diagrams and three model-checked
statecharts, plus source specifications and replayable synthetic evidence.

## Run locally

From Research:

```bash
npm --prefix wiki/source ci
npm --prefix wiki/source run clean
npm --prefix wiki/source run build
npm --prefix wiki/source run verify
python3 -m http.server 4010 --bind 127.0.0.1 --directory wiki/docs
```

The installed user unit is `research-wiki.service` (manual start, not enabled at login).
Use `systemctl --user start research-wiki.service` or the Python command above.

Open http://localhost:4010/. Generated `wiki/docs/` is ignored. Source and history
are tracked in Research; no submodule or separate wiki remote is required.
GitHub Pages and other external hosting are not configured. The root
`.github/workflows/wiki.yml` validates the nested wiki on PRs and pushes.

## Work with agents

Read [AGENTS.md](AGENTS.md), search with `node source/bin/wiki.js search TOPIC`,
and load the project using `node source/bin/wiki.js context "Research System"`
from this folder. Add findings to the owning article and keep dates, source
revisions and model assumptions explicit. Do not put raw research/mail/credential
material in this wiki. `CONTRIBUTING.md` contains the writing standards.

Architecture/model sources and rendered SVG/PNG live under the atlas's
`source/content/artifacts/research-architecture-and-statechart-atlas/` folder.
`./scripts/render-research-atlas` regenerates them using sibling diagram-generator
and statechart-generator checkouts; these tools are optional for ordinary reading.
The starter came from the locally supplied agent-wiki-template (commit
`042433f`); the template repository itself was not changed.

# Research Architecture Diagrams

These diagrams describe the current Research workspace, its independently versioned repositories, the running `iconium` services, and the workflows that turn discovered research into the published `wikip.co` site.

The YAML specifications in [`specs/`](specs/) are the editable sources. The committed SVGs are the preferred documentation format; matching PNGs are included for tools that do not render SVG. Repository file counts and runtime status were observed on `iconium` on 2026-08-03 and are point-in-time annotations, not architectural invariants.

## System and workflow views

### Project repository ecosystem

Ownership and data flow across `Research`, `research-tools`, `content`, `wikip.co`, and `public`, including GitHub, Cloudflare Pages, Docker Hub, Cloudinary, Gmail, and Google Scholar.

[Open SVG](rendered/project-repository-ecosystem.svg) · [Open PNG](rendered/project-repository-ecosystem.png) · [Edit specification](specs/project-repository-ecosystem.yaml)

![Research project repository ecosystem](rendered/project-repository-ecosystem.svg)

### Ideal end-to-end research workflow

The preferred path from alert ingestion and human triage through evidence extraction, content review, an exact-SHA site build, and production deployment.

[Open SVG](rendered/ideal-end-to-end-research-workflow.svg) · [Open PNG](rendered/ideal-end-to-end-research-workflow.png) · [Edit specification](specs/ideal-end-to-end-research-workflow.yaml)

![Ideal research-to-publication workflow](rendered/ideal-end-to-end-research-workflow.svg)

### Flat local development and build-fetch model

How a developer clones the coordinator, materializes standalone sibling repositories, verifies their Git boundaries, and prepares ignored content and output directories for a local Hexo build.

[Open SVG](rendered/local-development-build-fetch.svg) · [Open PNG](rendered/local-development-build-fetch.png) · [Edit specification](specs/local-development-build-fetch.yaml)

![Flat local development and build-fetch model](rendered/local-development-build-fetch.svg)

### Exact-SHA content publishing pipeline

The implemented GitHub Actions handoff from `content/main` to an isolated `wikip.co` build, generated `public` history, Cloudflare Pages, and the multi-architecture Docker image.

[Open SVG](rendered/cicd-exact-sha-publishing.svg) · [Open PNG](rendered/cicd-exact-sha-publishing.png) · [Edit specification](specs/cicd-exact-sha-publishing.yaml)

![Exact-SHA content publishing pipeline](rendered/cicd-exact-sha-publishing.svg)

### Iconium runtime and data topology

The currently observed local services and data boundaries: the triage UI, Codex jobs, SQLite primary database, nightly backup timer, FlareSolverr endpoint, credentials, external APIs, and NAS backup target.

[Open SVG](rendered/iconium-runtime-topology.svg) · [Open PNG](rendered/iconium-runtime-topology.png) · [Edit specification](specs/iconium-runtime-topology.yaml)

![Iconium Research runtime and data topology](rendered/iconium-runtime-topology.svg)

## Repository architecture views

### Research coordinator

The files owned by the coordinator, its flat-boundary CI guard, legacy migration mechanism, and ignored standalone workspace paths.

[Open SVG](rendered/research-coordinator-architecture.svg) · [Open PNG](rendered/research-coordinator-architecture.png) · [Edit specification](specs/research-coordinator-architecture.yaml)

![Research coordinator repository architecture](rendered/research-coordinator-architecture.svg)

### Research-tools components and dependencies

The Python workspace packages, command orchestration, triage/runtime surfaces, external systems, content checkout, and generated runtime data.

[Open SVG](rendered/research-tools-component-architecture.svg) · [Open PNG](rendered/research-tools-component-architecture.png) · [Edit specification](specs/research-tools-component-architecture.yaml)

![Research Tools component and dependency architecture](rendered/research-tools-component-architecture.svg)

### Research-tools paper lifecycle

The canonical state progression from a discovered candidate through scrape, match, draft, commit, pull request, merge, archival provenance, and the corresponding `papers` record.

[Open SVG](rendered/research-tools-paper-lifecycle.svg) · [Open PNG](rendered/research-tools-paper-lifecycle.png) · [Edit specification](specs/research-tools-paper-lifecycle.yaml)

![Canonical research paper workflow lifecycle](rendered/research-tools-paper-lifecycle.svg)

### Content repository

The Markdown category trees, article contract, authoring inputs, `content/main` ownership boundary, and rebuild-dispatch automation.

[Open SVG](rendered/content-repository-architecture.svg) · [Open PNG](rendered/content-repository-architecture.png) · [Edit specification](specs/content-repository-architecture.yaml)

![Content repository architecture](rendered/content-repository-architecture.svg)

### Wikip.co site repository

The tracked Hexo application, ignored build-time inputs and outputs, content preparation, site generation, image build, and generated-site publication.

[Open SVG](rendered/wikip-site-repository-architecture.svg) · [Open PNG](rendered/wikip-site-repository-architecture.png) · [Edit specification](specs/wikip-site-repository-architecture.yaml)

![Wikip.co site repository architecture](rendered/wikip-site-repository-architecture.svg)

### Public generated-site repository

The automation-owned deployment repository, its generated artifacts, Cloudflare Pages consumer, and explicit prohibition on manual source editing.

[Open SVG](rendered/public-repository-architecture.svg) · [Open PNG](rendered/public-repository-architecture.png) · [Edit specification](specs/public-repository-architecture.yaml)

![Public generated-site repository architecture](rendered/public-repository-architecture.svg)

## Regenerating the diagrams

The renderer intentionally uses the separate [`diagram-generator`](https://github.com/anthonyrussano/diagram-generator) repository. By default it expects that checkout at `~/diagram-generator`.

```bash
docs/diagrams/render-diagrams
```

If Graphviz is installed on the host, the wrapper runs the generator through `uv`. Otherwise it uses Podman and the local `diagram-gen:local` image. Build or refresh that image from the generator checkout with:

```bash
podman build --file ~/diagram-generator/Containerfile \
  --tag diagram-gen:local ~/diagram-generator
```

Override either location when needed:

```bash
DIAGRAM_GENERATOR_ROOT=/path/to/diagram-generator \
DIAGRAM_GENERATOR_IMAGE=diagram-gen:local \
docs/diagrams/render-diagrams
```

Commit the YAML specification and both rendered formats together. Inspect the PNG at full resolution after any layout change; a successful render does not guarantee readable edge routing.

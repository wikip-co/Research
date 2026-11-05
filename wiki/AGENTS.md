# Agent Instructions

These instructions apply to the entire repository.

## Mission

Use this repository as a durable knowledge base. Capture findings so that another human or agent can understand and reuse them without access to the originating chat, terminal session, or private scratchpad.

Published articles belong under `source/content/_posts/`. Prefer concise, evidence-backed documentation over session transcripts or unfiltered data dumps.

## Non-negotiable rules

- Run `git status --short --branch` before editing. Preserve unrelated or pre-existing changes.
- Search existing content before creating an article. Update the owning article when practical.
- Never commit credentials, authentication material, private keys, cookies, PHI, PII, or confidential raw data.
- Do not edit `docs/` directly. It is generated, ignored by Git, and served by a local static web server.
- Do not change the theme, dependencies, configuration, or workflow for a content-only task.
- Reuse existing category directories, tag capitalization, and terminology. Create a project folder under `Active Projects/` when the work has no existing home, following the placement rules below.
- Do not rename existing articles or categories merely to normalize style; published URLs and inbound links may change.
- Do not commit, push, open a pull request, or trigger an external action unless the user requested it or it is an explicitly authorized step in the current workflow.

## Start every task

```bash
git status --short --branch
node source/bin/wiki.js search "topic system exact error"
rg -n -i "topic|system|exact error" source/content/_posts
```

`node source/bin/wiki.js` is the wiki CLI (run `npm --prefix source ci` once first). It ranks results the same way as the site search and prints each article's URL, source path, folder and last update. Add `--json` to any reading command for machine-readable output.

## Gather project context

When you start work on an existing project, load its articles before doing anything else:

```bash
node source/bin/wiki.js projects                       # folders, article counts, last update
node source/bin/wiki.js context "PROJECT NAME"         # overview first, then every article, as Markdown
node source/bin/wiki.js context "PROJECT NAME" --list  # metadata and links only
node source/bin/wiki.js recent --days 14               # what changed recently, from Git
```

`context` accepts a project or folder name, a path such as `Reference/Authoring`, or one article's title or filename. The output lists the project's articles (overview first, then most recently updated), articles outside the folder that link to or from them, the folder's recent commits, and then each article's metadata and Markdown body. Article dates come from Git history. Status statements inside an article hold only as of the date the article gives.

Without a checkout, use the published equivalents: `llms.txt` (index of every article), `llms-full.txt` (all articles), `api/articles.json` (metadata, links and backlinks), `api/changes.json` (recent commits), and `ARTICLE_URL/index.md` (one article as Markdown with metadata).

Then read:

- `README.md` for the repository and publishing model.
- `CONTRIBUTING.md` for article and evidence standards.
- `source/content/_posts/template` before creating an article.
- One or two nearby articles to match the relevant category and terminology.

## Decide whether to update or create

Update an existing article when the new information:

- corrects or extends the same procedure;
- adds a verified failure mode or troubleshooting path;
- changes a version, prerequisite, or operational boundary; or
- would otherwise create a competing source of truth.

Create a new article when it has a distinct task, system boundary, decision, or audience. Choose its home using the article placement rules below. New filenames must be lowercase kebab-case and end in `.md`.

Scaffold new articles with the CLI. It refuses a title whose URL already exists, reuses existing tag spelling, and derives the filename from the title:

```bash
node source/bin/wiki.js new --title "PROJECT-SPECIFIC TITLE" --project "PROJECT NAME" --tags "Tag,Tag" --description "One-sentence summary."
node source/bin/wiki.js new --title "TITLE" --category "Reference/Authoring" --tags "Tag"
```

## Place articles by purpose

Use [CONTRIBUTING.md — Article placement and active projects](CONTRIBUTING.md#article-placement-and-active-projects) as the detailed placement guide.

- **Active project tracking:** put research, scope, timelines, decisions, meeting notes, implementation findings, and project-specific supporting notes under `source/content/_posts/Active Projects/PROJECT NAME/`. Reuse the project's folder even when an article discusses authoring, operations, publishing, or another technology. Do not scatter one project's history across technology categories.
- **Reusable how-to or reference:** put task instructions, tool usage, troubleshooting, and general platform explanations in the appropriate existing subject category, such as `Reference/Authoring/` or `Operations/Runbooks/`.
- **Both purposes:** keep project context and decisions in the project folder, and link to a separate reusable guide in the subject category. Maintain one authoritative copy of each procedure.

Create a clearly named project folder when no matching project exists. Start with articles directly inside it. Add subfolders such as `Research/`, `Planning/`, `Meeting Notes/`, or `Decisions/` only when the number of articles makes them useful; do not create an empty standard folder tree. A project may have one article or many.

For a project with multiple articles, maintain a project overview that links its research, scope/timeline, meeting notes, decisions, related repositories, and issue-tracker work. State the status and evidence date; distinguish proposed work from approved or completed work. Update the overview when adding a related article. A single article can serve as the overview until a separate one is useful.

Use descriptive lowercase kebab-case filenames and project-specific titles. The site uses title-based permalinks across all folders: generic titles such as “Overview” or “Meeting Notes” can collide. Date meeting-note filenames and titles (`YYYY-MM-DD`), and record decisions, open questions, and action owners rather than a raw transcript. Miscellaneous notes still need a clear topic, date, and link from the project overview.

Preserve existing titles and article URLs when reorganizing. Directory moves change category/navigation URLs even when the article URL stays stable; verify affected links and the generated hierarchy. Keep supporting files in `source/content/artifacts/ARTICLE_SLUG/` and link them from the owning article. Do not move unrelated articles as part of establishing a project folder.

When work ends, record its completed, paused, or superseded status and date in the overview. Do not leave historical findings presented as current. Follow an established archive convention if one exists; otherwise keep the links stable until an archive organization is chosen.

## Capture durable findings

An article should make these points recoverable when relevant:

- the problem, question, or decision;
- the date and environment in which facts were verified;
- prerequisites and scope boundaries;
- commands or steps that can be safely reproduced;
- evidence supporting the conclusion;
- observed facts versus inference;
- risks, limitations, and unresolved follow-up;
- stable sources and related wiki articles.

Use unmistakable placeholders such as `ACCOUNT_NAME`, `CLUSTER_NAME`, and `ROLE_NAME` in commands. Trim logs to the lines needed to explain the result. Never publish secret values or direct personal, patient, or payment identifiers.

Small sanitized JSON, YAML, CSV, or text artifacts may be placed under `source/content/artifacts/ARTICLE_SLUG/` when they materially support an article. Link them from the article, describe their provenance, and do not create orphaned dumps. Large or sensitive artifacts belong in an approved external system, with only a safe reference recorded here.

## Front matter and content

Required:

```yaml
---
title: Clear Article Title
tags:
  - Canonical Tag
---
```

Recommended:

```yaml
description: One sentence that says what the article establishes, for search, the home feed and agent indexes.
```

Optional:

```yaml
status: Current        # short label shown as a badge, for example Current, Historical, Superseded or Planned
overview: true         # marks the project overview when its filename or title does not contain "overview"
image: img/sample-knowledge-flow.svg
image_alt: Description of meaningful image content
```

Directory placement supplies categories; do not duplicate them in front matter. Git history supplies created and updated dates; do not add `date` or `updated` unless a date must be overridden. Search existing tags before introducing a spelling or capitalization variant. Omit `image_alt` for a purely decorative image.

Use headings that fit the material rather than forcing every article into a rigid template. Common useful sections are Summary, Context, Findings, Procedure, Validation, Limitations, Follow-up, and Sources.

## Validate

Lint every article change before building:

```bash
node source/bin/wiki.js lint
```

Errors (missing title, duplicate URL, broken link in a changed article, likely secret) fail the publishing and pull-request workflows. Warnings cover conventions such as filenames, tag spelling variants, missing anchors, template placeholders and unlinked artifacts. Style rules apply to files changed from `origin/main`; use `--all` to check every article.

For changes limited to root guidance files (`AGENTS.md`, `CONTRIBUTING.md`, and `README.md`), review consistency, examples and relative links, then run `git diff --check`. A site build is unnecessary because those files are not site inputs. For article, category, asset, or other site-source changes, use the build procedure below.

From the repository root:

```bash
cd source
nvm use
npm ci
npm run clean
npm run build
```

For visual or interactive changes, also run:

```bash
npm run server
```

and inspect `http://localhost:4000/` (or the configured site root).

The build writes to ignored `docs/`. Never stage generated output. Run `npm --prefix source run verify`, `git diff --check`, and recheck `git status` before committing.

## Commit and publish

For normal contributions, create a focused branch and pull request. Direct pushes to `main` require explicit maintainer authorization.

Stage only intentional source and documentation files. Use a concise commit message written as the repository contributor. Do not mention an agent, model, or generated authorship in commit messages.

When authorized to commit and push, publish source through the requested branch or pull-request workflow and check the **Validate Wiki** run for the source commit. CI validates the source and Docker image; it does not deploy to a LAN or publish an image.

LAN deployment is separate: on the authorized hosting machine, pull the approved source and run `docker compose up -d --build`. Confirm service health, then check the changed live article or asset from the intended client network. A push is not a LAN deployment.

The repository has no GitHub Pages deployment workflow. See [README.md](README.md#hosting-on-a-private-lan) for Docker, Compose, subpath and existing-server instructions.

Useful commands (substitute the repository):

```bash
gh run list --repo OWNER/REPOSITORY --workflow validate.yml --branch main --limit 5
gh run watch RUN_ID --repo OWNER/REPOSITORY --exit-status
```

## Handoff

Report:

- what changed and why;
- the article and supporting-file paths;
- validation performed, including the lint result;
- any caveats, uncertainty, or follow-up;
- commit, workflow, deployment, and live-site links when publishing was authorized.

A task is not published merely because the source commit was pushed; the source checks, LAN deployment, and live result are separate states.

## Research knowledge ownership

This is the Research project wiki, a normal tracked `wiki/` folder in the parent
Research repository. Its history and source remote are the parent's, not a
separate .git directory or submodule. The overview is Research System Overview.
The wiki owns the project's visual map, modelling assumptions, findings,
decisions and handoffs. Existing Research docs remain canonical for executable
procedures: link to them and record dated differences instead of rewriting history.

Run commands in this file from `wiki/` unless an example names the parent.
The site is local at localhost:4010. No GitHub Pages or external hosting is
configured. Committing/pushing source does not expose a running wiki service.
The parent CI owns validation; `wiki/.github/` template files are reference
material only and are not active workflows when nested.

Before updating articles, search and load Research System context. Sanitize
all evidence. Never copy raw mail, database contents, credentials or complete
model prompts/source packets into this repo. Keep example states explicitly
labelled synthetic. Diagram/model defects require a replay against code before
being called confirmed. Preserve known pre-existing tooling changes.

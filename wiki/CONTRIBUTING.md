# Contributing to the Agent Wiki

Contributions should preserve technical context in a form that remains useful across people, tools, and agent sessions.

## Knowledge quality

Good wiki content is:

- **Durable:** it explains the finding without relying on an unavailable conversation or terminal history.
- **Scoped:** it names the relevant environment, version, account, service, or boundary without exposing sensitive values.
- **Evidence-backed:** it distinguishes observed behavior from inference and links the sources supporting important claims.
- **Reproducible:** commands and procedures use safe placeholders and state their prerequisites.
- **Maintainable:** it has one clear home, avoids duplicate sources of truth, and identifies stale or superseded guidance.

Do not use the repository as an unrestricted log archive. Summarize noisy output and retain the smallest evidence needed to support the conclusion.

## Before writing

Search titles, body text, tags, and exact error strings:

```bash
node source/bin/wiki.js search "topic system exact error"
rg -n -i "topic|system|exact error" source/content/_posts
```

The search command supports the same syntax as the site search box: `"exact phrase"`, `-exclude`, `tag:Documentation`, `in:"Active Projects"` and `title:overview`. To read everything a project already records, run `node source/bin/wiki.js context "PROJECT NAME"`.

If an article already owns the topic, update it. Add a new article only when the material has a distinct purpose or lifecycle.

Review nearby content before selecting a directory. Directory names create the visible category hierarchy, so reuse existing spelling and capitalization. Avoid renaming established directories or articles unless redirects and inbound links have been considered.

## Article placement and active projects

Choose the article's home by its purpose, not just the technology it mentions.

| Purpose | Home | Examples |
| --- | --- | --- |
| Track an active project | `source/content/_posts/Active Projects/PROJECT NAME/` | Research, evaluation, scope, timelines, meeting notes, decisions, rollout findings, project-specific supporting notes |
| Explain how to perform a reusable task | The relevant existing subject category under `source/content/_posts/` | Configure a tool, diagnose a Kubernetes issue, rotate a credential, run a standard operation |
| Explain a reusable system or concept | The relevant existing subject category | Platform architecture, terminology, constraints, or reference material |
| Project work produces a reusable procedure | Project article plus a linked subject-category guide | Keep the project decision/history in its folder and the reusable instructions in one canonical guide |

An active project's technology does not determine its category. For example, a knowledge-base demonstration belongs under `Active Projects/Example Knowledge Base/` even when it covers authoring and publishing. General authoring and operations guides remain in their subject categories. Cross-link them instead of copying the same procedure into both places.

### Project folder structure

Reuse an existing project folder when it represents the same work. For a new project, use a concise, recognizable project name with human-readable capitalization. Filenames remain lowercase kebab-case.

This example illustrates a project with several articles; it is not a required set of files:

```text
source/content/_posts/
├── Active Projects/
│   └── Example Knowledge Base/
│       ├── example-knowledge-base-overview.md
│       ├── example-knowledge-base-research.md
│       ├── example-knowledge-base-scope-and-timeline.md
│       ├── example-knowledge-base-access-design.md
│       └── 2026-09-25-example-knowledge-base-meeting-notes.md
└── Reference/
    └── Authoring/
```

Start with a flat project folder. If it becomes difficult to browse, group multiple related articles into subfolders such as `Research/`, `Planning/`, `Meeting Notes/`, or `Decisions/`. Each nested directory becomes a visible subcategory. Create only folders with actual content, and avoid a second competing folder for the same project. Use descriptive names for miscellaneous supporting notes rather than a catch-all dump.

The existing knowledge-base overview can serve as that project's starting overview. Do not create placeholder overview or timeline articles merely to match the example.

### Overview and project article expectations

When a project spans multiple articles, its overview is the navigation entry point. It should identify the objective, status/as-of date, current scope, repositories, issue-tracker work, important decisions, open questions, and next steps. Link all related project articles and any reusable guides. Add new links as articles are written. Keep the issue tracker authoritative for ticket status; date any status summarized in the wiki.

Use the article type to guide its content:

- **Research:** question, approaches considered, dated evidence, findings, limitations, and recommendation.
- **Scope and timeline:** objectives, inclusions/exclusions, dependencies, milestones, and whether dates are proposed or agreed. Do not invent commitments.
- **Meeting notes:** meeting date and purpose, concise discussion context, decisions, open questions, and actions with owners and due dates when agreed. Link relevant tickets; avoid raw transcripts and private contact details.
- **Decisions:** selected approach, rationale, alternatives, consequences, and any later superseding decision.
- **Supporting notes:** a specific topic and why it matters to the project, with evidence and follow-up links.

Use globally distinct titles such as `Example Knowledge Base Scope and Timeline` and `Example Knowledge Base Meeting Notes 2026-09-25`. Avoid generic titles like `Overview`, `Research`, or `Meeting Notes`: the site's `:post_title/` permalink is shared across folders, so project directories do not prevent title collisions. Date meeting-note filenames as well as titles; a stable overview filename does not need a date.

### Links, reorganization, and lifecycle

Preserve a published title when moving an article. With the current permalink configuration, moving folders changes categories, not the article's title-based URL. Repository file links and category links do change, so update affected references and verify the generated navigation, search entry, and article URL. Use `{% post_link "Exact Article Title" %}` for internal articles and `{% site_link artifacts/ARTICLE_SLUG/report.csv "Download" %}` for files. These follow the configured site root when a fork changes its repository name. Do not assume filesystem-relative Markdown links resolve correctly on the site.

Supporting reports and small sanitized artifacts remain under `source/content/artifacts/ARTICLE_SLUG/`, regardless of the article's category. Keep those URLs stable and link each artifact from its owning article.

When a project completes, pauses, or is superseded, record the status, date, outcome, and successor links in its overview. Retain useful history and link reusable lessons to subject-category guides. If no archive convention exists, do not invent one or rename published content just to tidy the tree; decide the archive layout separately while preserving existing links.

## Create an article

From the website, use an article's **New** action. It opens GitHub's file editor in `source/content/_posts/` with the repository template pre-populated.

Locally, scaffold the article from the same template:

```bash
node source/bin/wiki.js new --title "Project-specific Title" --project "PROJECT NAME" --tags "Tag" --description "One-sentence summary."
node source/bin/wiki.js new --title "Guide Title" --category "Reference/Authoring" --tags "Tag"
```

The command creates the folder if needed, derives a kebab-case filename from the title, refuses titles whose URL already exists, and reuses existing tag spelling. Copying `source/content/_posts/template` by hand also works; use a lowercase, kebab-case filename ending in `.md`. Existing legacy filenames may use other styles; do not rename them solely for consistency.

## Front matter

Use a clear title and focused tags:

```yaml
---
title: Article Title
description: One sentence that says what the article establishes.
status: Current
tags:
  - Example
---
```

- `title` is required. Changing it may change the published URL, so avoid casual title changes.
- `description` is recommended. It appears under the title, in search results, category pages, `llms.txt` and the JSON manifest. Without it, the first paragraph is used.
- `status` is an optional short badge label, such as `Current`, `Historical`, `Superseded` or `Planned`. Keep the dated status sentence in the body as well.
- `overview: true` marks a project's overview article when its filename or title does not contain "overview". Project context and the home page list the overview first.
- `tags` should reuse existing capitalization and terminology. Tags appear as **Keywords** in the UI; there is no separate per-article `keywords` field. Definitions in `source/content/_data/description.yml` add explanations to keyword pages.
- `image` may be a filename from `source/content/img/`, a root-relative site path, or an external HTTP(S) URL.
- `image_alt` is recommended when the image conveys information. Omit it for decorative images.
- Categories come from the article's directory; a `categories` field is unnecessary.
- Git history supplies each article's created date, updated date and revision count. Do not maintain `date` or `updated` fields. A move without content changes is shown in the change feed but does not count as an update.
- `image` and `image_alt` are optional.

## Recommended article content

Use only the sections that improve the article:

- **Summary:** the outcome or answer first.
- **Context:** why the work was needed, scope, environment, and verification date.
- **Findings:** observed behavior and evidence.
- **Procedure:** prerequisites and reproducible commands.
- **Validation:** how the outcome was confirmed.
- **Limitations:** what was not tested or what remains uncertain.
- **Follow-up:** ownership and next actions.
- **Sources:** stable links, documents, tickets, or footnotes.

For investigations, explicitly label hypotheses and inferences. Do not present an unverified theory as a confirmed cause.

For procedures, use placeholders instead of live secrets or identifying values:

```bash
example-command --account ACCOUNT_NAME --role ROLE_NAME
```

Record exact error text when it is useful for future search, but remove tokens, session identifiers, personal data, and unrelated log noise.

## Supporting artifacts

Prefer Markdown, small text files, and reproducible snippets. Store downloadable Markdown as `.md.txt` so Hexo serves it as text rather than creating another page.

Small sanitized artifacts may be stored under:

```text
source/content/artifacts/ARTICLE_SLUG/
```

Use descriptive filenames and link every artifact from its owning article. State how and when the artifact was produced. Suitable examples include a minimal JSON response, a safe sample configuration, a compact CSV, or a redacted diagnostic excerpt.

Do not commit:

- credentials, cookies, private keys, or connection strings;
- PHI, PII, payment data, or direct personal contact details;
- full production exports or raw customer data;
- large logs, archives, database dumps, or generated binaries;
- artifacts whose provenance or owning article is unclear.

Store large or sensitive material in an approved system and include only a safe, stable reference.

## Images

Put reusable images in `source/content/img/` and use a descriptive filename. Optimize large images before committing. Confirm that the contributor has the right to publish external images; local assets are preferred when long-term availability matters.

## Links and sources

- Prefer stable primary sources and internal canonical documentation.
- Use descriptive link text instead of bare URLs when practical.
- Note the verification date for facts likely to change.
- Link related wiki articles to reduce duplicated explanation.
- Preserve short evidence excerpts rather than copying entire documents.

## Local validation

For root documentation changes only (`AGENTS.md`, `CONTRIBUTING.md`, `README.md`), check consistency, examples, relative links and `git diff --check`; these files do not require a site rebuild. Article moves and other site-source changes require the following build and navigation checks.

```bash
cd source
nvm use
npm ci
npm run lint
npm run clean
npm run build
npm run server
```

`npm run lint` (the same as `node source/bin/wiki.js lint` from the repository root) must report no errors. Fix warnings in the articles you changed.

Open `http://localhost:4000/` (or your configured `root`) and check:

- the article appears in the expected category;
- the title, image, tags, outline, and code blocks render correctly;
- local and external links use the intended destination;
- search finds the article using its title and important terms;
- the home page change feed and the Index show the article with the expected folder and dates (uncommitted local edits are marked as such);
- supporting assets load beneath the configured site root.

The build regenerates ignored `docs/`. Do not edit or commit generated files. Run `npm --prefix source run verify` from the repository root to check generated outputs and local links.

Finally run:

```bash
git diff --check
git status --short
```

## Pull requests and publishing

Use a focused pull request unless a maintainer explicitly authorizes a direct push to `main`. Complete the repository pull-request checklist and describe any unverified assumptions.

The **Validate Wiki** workflow tests, lints, builds, verifies local links, and smoke-tests the Docker image on pushes to `main` and pull requests. It does not deploy or publish an image. Generated output is ignored by Git. Hosting maintainers deploy approved source on the LAN using the README instructions; a source commit, passing validation, running container and verified live page are distinct checkpoints.

## Reviewing changes on the site

- The **home page** lists recent commits grouped by day, with each changed article marked New, Updated, Moved or Removed. Filter by change type; changes since your previous visit are highlighted. `changes.xml` is the same feed in Atom format.
- **Index** shows article counts and last-update ages for every folder and article, with a filter box and an A–Z or recently-updated sort.
- **All articles** is a sortable, filterable table of titles, folders, updated and created dates, revisions and length.
- Each **article** shows its created and updated dates, revision count, last commit message, and lists the other articles in its project, the articles that link to it, and related articles. Articles not updated for 180 days show a verification notice.
- **Search** ranks title, tag and heading matches above body text, highlights matches, links to matching sections, and accepts `"phrases"`, `-exclude`, `tag:`, `in:` and `title:`. Press `/` to focus it. The query is kept in the URL, so a search can be shared.

## Updating stale content

When guidance is no longer correct:

- update the owning article when a replacement is known;
- state what changed and the scope of the new behavior;
- preserve useful historical context when it explains migrations or compatibility;
- clearly mark deprecated procedures that must remain for reference; and
- link the successor rather than leaving contradictory instructions.

The objective is one trustworthy path forward, with enough history to understand why it changed.

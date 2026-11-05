'use strict';

// `hexo wiki <command>`: read and publish wiki content from a terminal or agent.
// From the repository root: `node source/bin/wiki.js <command>`
// (also `npm --prefix source run --silent wiki -- <command>` or, in source/, `npx hexo wiki <command>`).

const fs = require('node:fs');
const path = require('node:path');
const { normalize, search, snippet, parseQuery } = require('../themes/wiki/source/js/search-core');
const { articleMarkdown, changeLabel } = require('./outputs');
const { publicArticle, PROJECTS_CATEGORY } = require('./catalog');
const { lint, titleSlug } = require('./lint');

const HELP = `Usage: node source/bin/wiki.js <command> [options]   (or: npx hexo wiki <command>)

Reading
  search <query>          Ranked search. Supports "phrases", -exclude, tag:X, in:"Folder", title:X
  context <name>          Print a project/folder (all articles, overview first) or one article,
                          with dates, status and links, as Markdown. --list for metadata only.
  projects                List folders with article counts and last update
  recent                  Recent changes from Git (--days n, --limit n)

Publishing
  new --title "Title" (--project "Name" | --category "Reference/Authoring") [--tags "A,B"] [--description "..."]
  lint [--all] [--base origin/main] [--strict]

Add --json to search, context, projects, recent or lint for machine-readable output.
`;

function write(text) {
  process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}

function day(value) {
  return value ? String(value).slice(0, 10) : '';
}

function flattenFolders(node, list = []) {
  node.children.forEach(child => {
    list.push(child);
    flattenFolders(child, list);
  });
  return list;
}

function folderArticles(node, list = []) {
  list.push(...node.articles);
  node.children.forEach(child => folderArticles(child, list));
  return list;
}

function resolveTarget(catalog, name) {
  const needle = normalize(name).replace(/\/+$/, '');
  const folders = flattenFolders(catalog.folders);
  const exactFolders = folders.filter(folder => normalize(folder.name) === needle || normalize(folder.key) === needle);
  if (exactFolders.length === 1) return { folder: exactFolders[0] };

  const exactArticle = catalog.articles.find(article =>
    normalize(article.title) === needle ||
    article.path.replace(/\/$/, '') === needle ||
    normalize(article.file) === needle ||
    normalize(article.file.replace(/\.md$/, '')) === needle ||
    normalize(article.source).endsWith(needle));
  if (exactArticle) return { article: exactArticle };

  let partialFolders = folders.filter(folder => normalize(folder.key).includes(needle));
  partialFolders = partialFolders.filter(folder => !partialFolders.some(other => other !== folder && folder.key.startsWith(`${other.key}/`)));
  if (partialFolders.length === 1) return { folder: partialFolders[0] };

  const partialArticles = catalog.articles.filter(article => normalize(article.title).includes(needle));
  if (!partialFolders.length && partialArticles.length === 1) return { article: partialArticles[0] };

  return { candidates: [...partialFolders.map(folder => `folder:  ${folder.key}`), ...partialArticles.map(article => `article: ${article.title}`)] };
}

function articleRow(article) {
  const status = article.status ? ` · ${article.status}` : '';
  const overview = article.overview ? ' · overview' : '';
  return `- [${article.title}](${article.url}) — updated ${day(article.updated)}, ${article.revisions} revision(s)${overview}${status}\n  source: \`${article.source}\``;
}

function contextCommand(catalog, args) {
  const name = args._.slice(1).join(' ');
  if (!name) throw new Error('Usage: hexo wiki context <project, folder or article>');

  const target = resolveTarget(catalog, name);
  if (target.candidates) {
    const message = target.candidates.length
      ? `"${name}" is ambiguous or not found. Candidates:\n  ${target.candidates.join('\n  ')}`
      : `Nothing matches "${name}". Try: hexo wiki projects, or hexo wiki search ${name}`;
    throw new Error(message);
  }

  const articles = target.article ? [target.article] : folderArticles(target.folder)
    .sort((a, b) => Number(b.overview) - Number(a.overview) || String(b.updated).localeCompare(String(a.updated)));
  const inside = new Set(articles.map(article => article.path));
  const outside = [...new Set(articles.flatMap(article => [...article.links, ...article.backlinks]))]
    .filter(articlePath => !inside.has(articlePath))
    .map(articlePath => catalog.byPath.get(articlePath));
  const scope = target.article && target.article.categories.length
    ? (target.article.project ? [PROJECTS_CATEGORY, target.article.project] : target.article.categories).join('/')
    : '';
  const siblings = scope
    ? catalog.articles.filter(article => !inside.has(article.path) && `${article.categories.join('/')}/`.startsWith(`${scope}/`))
    : [];
  const changes = catalog.changes
    .filter(commit => commit.changes.some(change => change.path && inside.has(change.path)))
    .slice(0, 15);

  if (args.json) {
    write(JSON.stringify({
      target: target.folder ? { type: 'folder', path: target.folder.key, href: target.folder.href } : { type: 'article', path: target.article.path },
      articles: articles.map(article => ({ ...publicArticle(article), markdown: args.list ? undefined : article.markdown })),
      linked_articles: outside.map(publicArticle),
      sibling_articles: siblings.map(publicArticle),
      recent_changes: changes
    }, null, 2));
    return;
  }

  const heading = target.folder ? target.folder.key.split('/').join(' / ') : target.article.title;
  const lines = [
    `# Wiki context: ${heading}`,
    '',
    `Generated ${day(catalog.generated)} from the wiki source. Dates come from Git history. Treat status statements inside articles as true only as of the date they give.`,
    ''
  ];
  if (target.folder) {
    lines.push(`Folder \`${target.folder.key}\`: ${articles.length} article(s), last updated ${day(target.folder.updated)}.`, '');
  }
  lines.push('## Articles', '', ...articles.map(articleRow), '');
  if (siblings.length) {
    lines.push(`## Other articles in ${scope.split('/').join(' / ')}`, '', ...siblings.map(articleRow), '');
  }
  if (outside.length) {
    lines.push('## Linked articles outside this scope', '', ...outside.map(articleRow), '');
  }
  if (changes.length) {
    lines.push('## Recent changes', '');
    changes.forEach(commit => {
      const touched = commit.changes.filter(change => change.path && inside.has(change.path)).map(change => `${changeLabel(change)}: ${change.title}`);
      lines.push(`- ${day(commit.date)} ${commit.short} ${commit.subject} (${touched.join('; ')})`);
    });
    lines.push('');
  }
  if (!args.list) {
    articles.forEach((article, index) => lines.push(`<!-- ===== Article ${index + 1} of ${articles.length}: ${article.source} ===== -->`, '', articleMarkdown(article)));
  }
  write(lines.join('\n'));
}

function searchCommand(catalog, args) {
  const input = args._.slice(1).join(' ');
  if (!input) throw new Error('Usage: hexo wiki search <query>');
  const limit = Number(args.limit) || 10;
  const results = search(catalog.articles, input, { limit });
  const terms = parseQuery(input).terms;

  if (args.json) {
    write(JSON.stringify(results.map(result => ({
      score: Math.round(result.score * 10) / 10,
      section: result.section,
      ...publicArticle(result.entry)
    })), null, 2));
    return;
  }
  if (!results.length) {
    write(`No results for ${input}`);
    return;
  }
  results.forEach((result, index) => {
    const article = result.entry;
    const excerpt = snippet(article.text, terms, 220).map(part => (part.match ? `**${part.text}**` : part.text)).join('');
    write([
      `${index + 1}. ${article.title}`,
      `   ${article.url}${result.section ? `#${result.section.id}` : ''}`,
      `   ${article.categories.join(' / ')} · updated ${day(article.updated)}${article.status ? ` · ${article.status}` : ''} · source: ${article.source}`,
      `   ${excerpt}`,
      ''
    ].join('\n'));
  });
}

function projectsCommand(catalog, args) {
  const folders = flattenFolders(catalog.folders);
  if (args.json) {
    write(JSON.stringify(folders.map(folder => ({
      path: folder.key,
      href: folder.href,
      articles: folder.count,
      updated: folder.updated,
      overview: (folder.articles.find(article => article.overview) || {}).title || null
    })), null, 2));
    return;
  }
  folders.forEach(folder => {
    const depth = folder.key.split('/').length - 1;
    write(`${'  '.repeat(depth)}${folder.name}  (${folder.count} article${folder.count === 1 ? '' : 's'}, updated ${day(folder.updated)})`);
  });
}

function recentCommand(catalog, args) {
  const limit = Number(args.limit) || 20;
  const since = args.days ? Date.now() - Number(args.days) * 86400000 : 0;
  const commits = catalog.changes.filter(commit => new Date(commit.date).getTime() >= since).slice(0, limit);
  if (args.json) {
    write(JSON.stringify(commits, null, 2));
    return;
  }
  commits.forEach(commit => {
    write(`${day(commit.date)}  ${commit.short}  ${commit.subject}  (${commit.author})`);
    commit.changes.forEach(change => {
      const where = change.status === 'moved' ? `${change.previous_folder.join(' / ')} → ${change.folder.join(' / ')}` : change.folder.join(' / ');
      write(`    ${changeLabel(change).padEnd(8)} ${change.title}  [${where}]${change.removed ? ' (since removed)' : ''}`);
    });
  });
}

function newCommand(hexo, catalog, args) {
  const title = String(args.title || '').trim();
  if (!title || (!args.project && !args.category)) {
    throw new Error('Usage: hexo wiki new --title "Project-specific Title" (--project "Project Name" | --category "Reference/Authoring") [--tags "A,B"] [--description "..."]');
  }

  const folder = args.project ? path.join(PROJECTS_CATEGORY, String(args.project)) : String(args.category).replace(/^\/+|\/+$/g, '');
  const directory = path.join(hexo.source_dir, '_posts', folder);
  const filename = args.file ? String(args.file) : `${titleSlug(hexo, title).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}.md`;
  const target = path.join(directory, filename);
  const slug = `${titleSlug(hexo, title)}/`;
  const collision = catalog.byPath.get(slug) || hexo.locals.get('pages').toArray().find(page => page.path.replace(/index\.html$/, '') === slug);

  if (collision) throw new Error(`The title produces /${slug}, which already exists (${collision.title || collision.source}). Choose a more specific title.`);
  if (fs.existsSync(target)) throw new Error(`${target} already exists.`);

  const existingFolders = new Set(flattenFolders(catalog.folders).map(node => node.key));
  const tags = String(args.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const knownTags = new Map(hexo.locals.get('tags').map(tag => [tag.name.toLowerCase().replace(/[\s_-]+/g, ''), tag.name]));
  const resolvedTags = tags.map(tag => knownTags.get(tag.toLowerCase().replace(/[\s_-]+/g, '')) || tag);

  const templatePath = path.join(hexo.source_dir, '_posts', 'template');
  const template = fs.readFileSync(templatePath, 'utf8');
  const body = template.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const fields = [`title: ${JSON.stringify(title)}`];
  if (args.description) fields.push(`description: ${JSON.stringify(String(args.description))}`);
  fields.push('tags:', ...(resolvedTags.length ? resolvedTags : ['TAG']).map(tag => `  - ${tag}`));
  const content = `---\n${fields.join('\n')}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`;

  const relative = path.relative(path.dirname(hexo.base_dir), target);
  if (args['dry-run']) {
    write(`# ${relative}\n${content}`);
    return;
  }
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(target, content);
  write([
    `Created ${relative}`,
    `URL after publishing: ${String(hexo.config.url).replace(/\/+$/, '')}/${slug}`,
    existingFolders.has(folder.split(path.sep).join('/')) ? '' : `New folder: ${folder}. If this is a multi-article project, add an overview article that links the others.`,
    resolvedTags.some((tag, index) => tag !== tags[index]) ? `Tags normalized to existing spelling: ${resolvedTags.join(', ')}` : '',
    'Next: write the article, then run `node source/bin/wiki.js lint` and `npm --prefix source run build`.'
  ].filter(Boolean).join('\n'));
}

function lintCommand(hexo, catalog, args) {
  const problems = lint(hexo, catalog, { all: args.all, base: args.base });
  const errors = problems.filter(problem => problem.level === 'error');
  const warnings = problems.filter(problem => problem.level === 'warn');

  if (args.json) {
    write(JSON.stringify({ errors: errors.length, warnings: warnings.length, problems }, null, 2));
  } else {
    const order = { error: 0, warn: 1, info: 2 };
    const infoCounts = new Map();
    problems.filter(problem => problem.level === 'info').forEach(problem => infoCounts.set(problem.rule, (infoCounts.get(problem.rule) || 0) + 1));
    const unchanged = args.all ? [] : problems.filter(problem => problem.level === 'warn' && !problem.changed);
    problems
      .filter(problem => !unchanged.includes(problem))
      .filter(problem => problem.level !== 'info' || infoCounts.get(problem.rule) <= 5)
      .sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file) || a.line - b.line)
      .forEach(problem => write(`${problem.level.toUpperCase().padEnd(5)} ${problem.file}${problem.line ? `:${problem.line}` : ''}  [${problem.rule}] ${problem.message}`));
    infoCounts.forEach((count, rule) => {
      if (count > 5) write(`INFO  ${count} articles  [${rule}] ${problems.find(problem => problem.rule === rule).message}`);
    });
    if (unchanged.length) write(`WARN  ${unchanged.length} warning(s) in unchanged articles are hidden; run with --all to list them.`);
    write(`\n${errors.length} error(s), ${warnings.length} warning(s)${args.all ? '' : ' (style rules: changed files only; use --all for every article)'}`);
  }

  if (errors.length || (args.strict && warnings.length)) process.exitCode = 1;
}

async function run(hexo, args, getCatalog) {
  const command = args._[0];
  if (!command || command === 'help') {
    write(HELP);
    return;
  }

  const commands = {
    context: () => contextCommand(getCatalog(), args),
    search: () => searchCommand(getCatalog(), args),
    projects: () => projectsCommand(getCatalog(), args),
    recent: () => recentCommand(getCatalog(), args),
    new: () => newCommand(hexo, getCatalog(), args),
    lint: () => lintCommand(hexo, getCatalog(), args)
  };
  if (!commands[command]) {
    write(HELP);
    process.exitCode = 1;
    return;
  }

  // Keep stdout clean for agents: show Hexo warnings and errors only.
  if (!args.debug && hexo.log.level < 40) hexo.log.level = 40;
  await hexo.load();
  try {
    commands[command]();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { run };

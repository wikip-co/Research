'use strict';

// Site features built on Git history and the article catalog:
// - article dates, revision counts and the change feed (lib/history.js)
// - template helpers used by the theme
// - llms.txt, api/*.json, search.json, changes.xml and per-article index.md
// - the `hexo wiki` command for authors and agents (lib/cli.js)

const { applyGitHistory } = require('../lib/history');
const { buildCatalog } = require('../lib/catalog');
const outputs = require('../lib/outputs');
const cli = require('../lib/cli');
const hexoUtilPath = require.resolve('hexo-util', { paths: [require.resolve('hexo')] });
const { url_for, escapeHTML } = require(hexoUtilPath);

// Portable local links; emit a full HTML anchor because Hexo tag placeholders
// cannot be nested inside Markdown link destinations.
// {% site_link artifacts/article-slug/report.csv "Download report" %}
hexo.extend.tag.register('site_link', function siteLink(args) {
  const [value, ...label] = args;
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value) || value.split('/').includes('..')) {
    throw new Error('site_link needs a local site path without parent traversal.');
  }
  const href = escapeHTML(url_for.call(hexo, value.replace(/^\/+/, '')));
  return `<a href="${href}">${escapeHTML(label.join(' ') || value)}</a>`;
});

function catalog(ctx) {
  if (!ctx.wikiCatalog) ctx.wikiCatalog = buildCatalog(ctx);
  return ctx.wikiCatalog;
}

hexo.extend.filter.register('before_generate', async function wikiHistory() {
  this.wikiCatalog = null;
  await applyGitHistory(this);
});

hexo.extend.generator.register('wiki_outputs', function wikiOutputs() {
  return outputs.routes(catalog(this), this.config);
});

hexo.extend.helper.register('wiki_catalog', () => catalog(hexo));

hexo.extend.helper.register('wiki_article', post => (post && post.path ? catalog(hexo).byPath.get(post.path) : null));

// Renders a <time> element. wiki-ui.js adds a relative label ("3 days ago")
// in the browser, because a static page cannot know when it is being read.
hexo.extend.helper.register('wiki_time', function wikiTime(value, options = {}) {
  if (!value) return '';
  const format = options.format || 'YYYY-MM-DD';
  const label = this.date(value, format);
  const full = this.date(value, 'dddd, MMMM D, YYYY h:mm A z');
  const mode = options.relative === undefined || options.relative === true ? '' : options.relative;
  const relative = mode === false ? '' : ` data-relative="${mode}"`;
  const className = options.class ? ` class="${options.class}"` : '';
  return `<time datetime="${new Date(value).toISOString()}" title="${full}"${className}${relative}>${label}</time>`;
});

hexo.extend.helper.register('wiki_change_label', change => outputs.changeLabel(change));

hexo.extend.console.register('wiki', 'Search, read, scaffold and lint wiki articles', {
  usage: '<command> [arguments]',
  arguments: [
    { name: 'search <query>', desc: 'Ranked article search (same ranking as the site)' },
    { name: 'context <name>', desc: 'Print a project, folder or article (with metadata) as Markdown' },
    { name: 'projects', desc: 'List folders with article counts and last update' },
    { name: 'recent', desc: 'List recent changes from Git history' },
    { name: 'new', desc: 'Create an article from the template' },
    { name: 'lint', desc: 'Check front matter, links, tags, artifacts and secrets' }
  ],
  options: [
    { name: '--json', desc: 'Machine-readable output (search, context, projects, recent, lint)' },
    { name: '--list', desc: 'context: metadata only, without article bodies' },
    { name: '--limit <n>', desc: 'search/recent: number of results' },
    { name: '--days <n>', desc: 'recent: only changes from the last n days' },
    { name: '--title <title>', desc: 'new: article title (required)' },
    { name: '--project <name>', desc: 'new: Active Projects folder' },
    { name: '--category <path>', desc: 'new: subject folder, for example "Reference/Authoring"' },
    { name: '--tags <a,b>', desc: 'new: comma-separated tags' },
    { name: '--description <text>', desc: 'new: one-sentence summary' },
    { name: '--dry-run', desc: 'new: print the file without writing it' },
    { name: '--all', desc: 'lint: apply style rules to every article, not only changed ones' },
    { name: '--base <ref>', desc: 'lint: Git ref that defines changed files (default origin/main)' },
    { name: '--strict', desc: 'lint: exit non-zero on warnings too' }
  ]
}, function wikiCommand(args) {
  return cli.run(this, args, () => catalog(this));
});

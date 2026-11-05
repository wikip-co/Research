'use strict';

// `hexo wiki lint`: publishing checks for articles. Errors block publishing in
// CI; warnings point at conventions from CONTRIBUTING.md.
//
// Duplicate URLs, missing titles and secrets are errors everywhere. Broken
// links are errors in changed articles and warnings elsewhere. Style rules
// (filenames, tags, placeholders) apply only to changed articles unless --all
// is given, so legacy content does not block publishing or drown out new
// problems.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const hexoUtilPath = require.resolve('hexo-util', { paths: [require.resolve('hexo')] });
const { slugize } = require(hexoUtilPath);
const { anchorFromHref, sitePathFromHref, repositoryUrl } = require('./catalog');
const { frontMatterValue, toPosix } = require('./history');

const GENERIC_TITLES = new Set(['overview', 'meeting notes', 'research', 'notes', 'summary', 'decisions', 'plan', 'timeline', 'scope', 'article title']);
const KEBAB_FILENAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const TEMPLATE_MARKERS = ['Article Title', 'One-sentence summary shown in search', '[^1]: https://example.com/'];

// High-confidence credential formats. Values are never printed.
const SECRET_PATTERNS = [
  ['private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ['AWS access key ID', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/],
  ['OpenAI API key', /\bsk-(?:proj-|admin-|svcacct-)?[A-Za-z0-9_-]{32,}\b/],
  ['JSON Web Token', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['connection string password', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]{6,}@/i]
];
const TEXT_ARTIFACT = /\.(?:txt|md|json|ya?ml|csv|sql|py|sh|tf|example|xml|ini|cfg|conf|ps1)$/i;

function lineOf(raw, needle) {
  const index = raw.indexOf(needle);
  return index === -1 ? 1 : raw.slice(0, index).split('\n').length;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function changedFiles(repoRoot, base) {
  const files = new Set();
  const add = output => output.split('\n').filter(Boolean).forEach(file => files.add(file.replace(/^"(.*)"$/, '$1')));
  try {
    add(git(['-c', 'core.quotePath=false', 'diff', '--name-only', '--diff-filter=AMR', `${base}...HEAD`], repoRoot));
  } catch (error) {
    // The base ref is unavailable (for example, no remote); fall back to local changes.
  }
  try {
    git(['-c', 'core.quotePath=false', 'status', '--porcelain', '--untracked-files=all'], repoRoot)
      .split('\n').filter(Boolean)
      .forEach(line => files.add(line.slice(3).replace(/^.* -> /, '').replace(/^"(.*)"$/, '$1')));
  } catch (error) {
    // Not a Git checkout.
  }
  return files;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function scanSecrets(text, report, file) {
  text.split('\n').forEach((line, index) => {
    SECRET_PATTERNS.forEach(([name, pattern]) => {
      if (pattern.test(line)) report('error', 'secret', file, index + 1, `Possible ${name}. Remove it and rotate the credential if it was real.`);
    });
  });
}

function lint(hexo, catalog, options = {}) {
  const problems = [];
  const repoRoot = (hexo.wikiHistory && hexo.wikiHistory.repoRoot) || path.dirname(hexo.base_dir);
  const routes = new Set(hexo.route.list());
  const posts = hexo.locals.get('posts').toArray();
  const pages = hexo.locals.get('pages').toArray();
  const changed = options.all ? null : changedFiles(repoRoot, options.base || 'origin/main');
  const inScope = source => !changed || changed.has(source);
  const report = (level, rule, file, line, message) => problems.push({ level, rule, file, line, message, changed: inScope(file) });
  const repository = repositoryUrl(hexo.locals.toObject());
  const branch = String((hexo.locals.get('data').resources || {}).branch || 'main');
  const artifactsDir = path.join(hexo.source_dir, 'artifacts');
  const linkedArtifacts = new Set();
  const idsByPath = new Map();

  posts.forEach(post => {
    const ids = new Set();
    String(post.content).replace(/\sid="([^"]+)"/g, (match, id) => ids.add(id));
    idsByPath.set(post.path, ids);
  });

  // Duplicate URLs, including collisions with stand-alone pages such as redirect stubs.
  const owners = new Map();
  [...posts, ...pages].forEach(doc => {
    const key = doc.path.replace(/index\.html$/, '');
    if (!owners.has(key)) owners.set(key, []);
    owners.get(key).push(doc);
  });
  owners.forEach((docs, url) => {
    if (docs.length < 2) return;
    docs.filter(doc => doc.full_source && doc.full_source.includes(`${path.sep}_posts${path.sep}`)).forEach(doc => {
      const others = docs.filter(other => other !== doc).map(other => toPosix(path.relative(repoRoot, other.full_source)));
      report('error', 'duplicate-url', toPosix(path.relative(repoRoot, doc.full_source)), 1,
        `URL /${url} is also produced by ${others.join(', ')}. Titles determine URLs; choose a distinct title.`);
    });
  });

  // Tag spelling variants across the whole site.
  const tagVariants = new Map();
  posts.forEach(post => post.tags.forEach(tag => {
    const key = tag.name.toLowerCase().replace(/[\s_-]+/g, '');
    if (!tagVariants.has(key)) tagVariants.set(key, new Map());
    const spellings = tagVariants.get(key);
    spellings.set(tag.name, (spellings.get(tag.name) || 0) + 1);
  }));

  catalog.articles.forEach(article => {
    const post = posts.find(candidate => candidate.path === article.path);
    const file = article.source;
    const raw = post.raw || '';
    const styleChecks = inScope(file);

    if (!frontMatterValue(raw, 'title')) report('error', 'missing-title', file, 1, 'Front matter needs a title.');

    scanSecrets(raw, report, file);

    article.html_links.forEach(href => {
      const sitePath = sitePathFromHref(href, hexo.config);
      if (sitePath !== null) {
        if (sitePath.startsWith('artifacts/')) linkedArtifacts.add(sitePath.replace(/\/$/, ''));
        const candidates = [sitePath, `${sitePath}index.html`, `${sitePath.replace(/\/$/, '')}/index.html`];
        if (!candidates.some(candidate => routes.has(candidate))) {
          report(styleChecks ? 'error' : 'warn', 'broken-link', file, lineOf(raw, href.split('#')[0]), `Link target does not exist on the site: ${href}`);
          return;
        }
        const anchor = anchorFromHref(href);
        const target = catalog.byPath.get(sitePath) || catalog.byPath.get(`${sitePath}/`);
        if (anchor && target && !idsByPath.get(target.path).has(anchor)) {
          report('warn', 'broken-anchor', file, lineOf(raw, href), `"${target.title}" has no section #${anchor}.`);
        }
        return;
      }

      const repoPrefix = new RegExp(`^${repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?:blob|tree|raw)/${branch}/`);
      if (repository && repoPrefix.test(href)) {
        let repoPath = href.replace(repoPrefix, '').replace(/[?#].*$/, '');
        try {
          repoPath = decodeURIComponent(repoPath);
        } catch (error) {
          // Report the encoded path below.
        }
        const artifactPrefix = `${toPosix(path.relative(repoRoot, artifactsDir))}/`;
        if (repoPath.startsWith(artifactPrefix)) linkedArtifacts.add(`artifacts/${repoPath.slice(artifactPrefix.length)}`.replace(/\/$/, ''));
        if (!fs.existsSync(path.join(repoRoot, repoPath))) {
          report('warn', 'broken-repo-link', file, lineOf(raw, href), `Repository file no longer exists: ${repoPath}`);
        }
        return;
      }

      if (!/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href) && /\.md(?:#|$)/.test(href)) {
        report('warn', 'relative-md-link', file, lineOf(raw, href), `Relative Markdown link "${href}" will not resolve on the site; link the published article URL.`);
      }
    });

    if (!styleChecks) return;

    if (!KEBAB_FILENAME.test(article.file)) {
      report('warn', 'filename', file, 1, 'Use a lowercase kebab-case filename ending in .md.');
    }
    if (/meeting-notes/.test(article.file) && !/\d{4}-\d{2}-\d{2}/.test(article.file)) {
      report('warn', 'meeting-notes-date', file, 1, 'Date meeting-note filenames and titles (YYYY-MM-DD).');
    }
    if (GENERIC_TITLES.has(article.title.toLowerCase())) {
      report('warn', 'generic-title', file, 1, `Title "${article.title}" is generic; titles are shared URLs across all folders.`);
    }
    if (!article.tags.length) report('warn', 'missing-tags', file, 1, 'Add at least one tag, reusing existing spelling.');
    article.tags.forEach(tag => {
      const spellings = tagVariants.get(tag.toLowerCase().replace(/[\s_-]+/g, ''));
      if (spellings.size > 1) {
        const preferred = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
        if (preferred !== tag) report('warn', 'tag-variant', file, lineOf(raw, tag), `Tag "${tag}" duplicates "${preferred}" (used ${spellings.get(preferred)} times).`);
      }
    });
    if (/^categories:/m.test(raw.split(/\n---/)[0])) {
      report('warn', 'categories-front-matter', file, lineOf(raw, 'categories:'), 'Remove categories from front matter; the folder sets them.');
    }
    if (!article.categories.length) {
      report('warn', 'uncategorized', file, 1, 'Place the article in a project or subject folder.');
    }
    TEMPLATE_MARKERS.forEach(marker => {
      if (raw.includes(marker)) report('warn', 'template-placeholder', file, lineOf(raw, marker), `Template placeholder remains: "${marker}".`);
    });
    if (article.tags.includes('Example')) report('warn', 'template-placeholder', file, lineOf(raw, 'Example'), 'Template tag "Example" remains.');
    if (!article.has_description) {
      report('info', 'missing-description', file, 1, 'Add a one-sentence `description` for search, the home feed and agent indexes.');
    }

    const image = frontMatterValue(raw, 'image');
    if (image && !/^(?:https?:)?\/\//i.test(image)) {
      const sitePath = image.startsWith('/') ? sitePathFromHref(image, hexo.config) : (image.includes('/') ? image.replace(/^\.?\//, '') : `img/${image}`);
      if (sitePath === null || !routes.has(sitePath)) report('warn', 'missing-image', file, lineOf(raw, 'image:'), `Image not found: ${image}`);
    }
  });

  // Artifacts: secrets in text files, and folders no article links to.
  const artifactFolders = new Set();
  walk(artifactsDir).forEach(full => {
    const relative = toPosix(path.relative(hexo.source_dir, full));
    artifactFolders.add(relative.split('/').slice(0, 2).join('/'));
    if (TEXT_ARTIFACT.test(full) && fs.statSync(full).size < 5 * 1024 * 1024) {
      scanSecrets(fs.readFileSync(full, 'utf8'), report, toPosix(path.relative(repoRoot, full)));
    }
  });
  artifactFolders.forEach(folder => {
    const linked = [...linkedArtifacts].some(link => link === folder || link.startsWith(`${folder}/`));
    const source = toPosix(path.relative(repoRoot, path.join(hexo.source_dir, folder)));
    if (!linked && (options.all || [...(changed || [])].some(file => file.startsWith(`${source}/`)))) {
      report('warn', 'orphan-artifact', source, 0, 'No article links to this artifact folder.');
    }
  });

  return problems;
}

// Mirrors Hexo's :post_title permalink so new titles can be checked for collisions.
function titleSlug(hexo, title) {
  return slugize(title, { transform: hexo.config.filename_case });
}

module.exports = { lint, titleSlug, changedFiles };

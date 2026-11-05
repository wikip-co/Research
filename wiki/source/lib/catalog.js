'use strict';

// Builds one structured view of every published article. The theme, the
// machine-readable outputs (api/*.json, llms.txt, search.json) and the
// `hexo wiki` CLI all read from this catalog so they never disagree.

const path = require('node:path');
const hexoUtilPath = require.resolve('hexo-util', { paths: [require.resolve('hexo')] });
const { stripHTML, tocObj, unescapeHTML } = require(hexoUtilPath);
const { historicalTitle, toPosix } = require('./history');

const PROJECTS_CATEGORY = 'Active Projects';
const WORDS_PER_MINUTE = 200;
const EXCERPT_LENGTH = 280;

function plainText(html) {
  return unescapeHTML(stripHTML(String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|pre|blockquote)>/gi, '$& ')
    .replace(/<br\s*\/?>/gi, ' ')))
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateWords(text, length) {
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), length * 0.6)).replace(/[\s,;:.]+$/, '')}…`;
}

function firstParagraph(html) {
  const paragraphs = String(html || '').match(/<p>[\s\S]*?<\/p>/gi) || [];
  for (const paragraph of paragraphs) {
    const text = plainText(paragraph);
    if (text.length > 40) return text;
  }
  return plainText(paragraphs[0] || '');
}

function frontMatterString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isOverview(post, file) {
  if (post.overview === true) return true;
  if (post.overview === false) return false;
  return /(^|-)overview(-|\.md$)/.test(file) || /\boverview\b/i.test(post.title || '');
}

// Normalizes an href to a site-relative path ("slug/") when it targets this site.
function sitePathFromHref(href, config) {
  const root = config.root || '/';
  const siteUrl = String(config.url || '').replace(/\/+$/, '');
  let value = unescapeHTML(href).trim();

  if (siteUrl && value.startsWith(siteUrl)) value = value.slice(siteUrl.length) || '/';
  if (!value.startsWith(root)) return null;

  value = value.slice(root.length).replace(/[?#].*$/, '');
  try {
    value = decodeURI(value);
  } catch (error) {
    // Keep the raw value; the link check reports it if it does not resolve.
  }
  return value.replace(/index\.html$/, '');
}

function anchorFromHref(href) {
  const hash = /#(.+)$/.exec(unescapeHTML(href));
  if (!hash) return '';
  try {
    return decodeURIComponent(hash[1]);
  } catch (error) {
    return hash[1];
  }
}

function linksIn(html) {
  const links = [];
  const pattern = /<a\s[^>]*href="([^"]+)"/gi;
  let match;
  while ((match = pattern.exec(html))) links.push(match[1]);
  return links;
}

function categoryIndex(locals, root) {
  const byId = new Map();
  locals.categories.forEach(category => byId.set(category._id, category));
  const byKey = new Map();
  byId.forEach(category => {
    const names = [];
    for (let current = category; current; current = byId.get(current.parent)) names.unshift(current.name);
    byKey.set(names.join('/'), `${root}${category.path}`);
  });
  return byKey;
}

function buildCatalog(hexo, locals = hexo.locals.toObject()) {
  const config = hexo.config;
  const root = config.root || '/';
  const siteUrl = String(config.url || '').replace(/\/+$/, '');
  const postsRoot = path.join(hexo.source_dir, '_posts');
  const categoryUrls = categoryIndex(locals, root);
  const history = hexo.wikiHistory || { commits: [], files: new Map() };

  const articles = locals.posts.toArray().map(post => {
    const relativeFile = toPosix(path.relative(postsRoot, post.full_source));
    const folders = path.posix.dirname(relativeFile) === '.' ? [] : path.posix.dirname(relativeFile).split('/');
    const text = plainText(post.content);
    const words = text ? text.split(' ').length : 0;
    const description = frontMatterString(post.description);

    return {
      id: post._id,
      title: post.title || '(Untitled)',
      path: post.path,
      href: `${root}${post.path}`,
      url: `${siteUrl}/${post.path}`,
      markdown_href: `${root}${post.path}index.md`,
      source: post.repo_path || toPosix(path.join(path.relative(path.dirname(hexo.base_dir), hexo.source_dir), '_posts', relativeFile)),
      file: path.posix.basename(relativeFile),
      categories: folders,
      category_href: folders.length ? categoryUrls.get(folders.join('/')) || '' : '',
      project: folders[0] === PROJECTS_CATEGORY && folders[1] ? folders[1] : null,
      overview: isOverview(post, path.posix.basename(relativeFile)),
      status: frontMatterString(post.status),
      description: description || truncateWords(firstParagraph(post.content), EXCERPT_LENGTH),
      has_description: Boolean(description),
      tags: post.tags.map(tag => tag.name).sort((a, b) => a.localeCompare(b)),
      tag_links: post.tags.map(tag => ({ name: tag.name, href: `${root}${tag.path}` })),
      created: post.date ? post.date.toISOString() : null,
      updated: post.updated ? post.updated.toISOString() : null,
      revisions: post.revisions || 0,
      last_commit: post.last_commit || null,
      uncommitted: Boolean(post.uncommitted),
      headings: tocObj(post.content, { min_depth: 2, max_depth: 4 }).map(heading => ({
        level: heading.level,
        id: heading.id,
        text: unescapeHTML(heading.text)
      })),
      words,
      reading_minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
      text,
      markdown: post._content || '',
      html_links: linksIn(post.content),
      links: [],
      backlinks: [],
      related: []
    };
  });

  const byPath = new Map(articles.map(article => [article.path, article]));
  const bySource = new Map(articles.map(article => [article.source, article]));

  // Internal links, backlinks and related articles.
  articles.forEach(article => {
    const targets = new Set();
    article.html_links.forEach(href => {
      const sitePath = sitePathFromHref(href, config);
      if (sitePath === null) return;
      const target = byPath.get(sitePath) || byPath.get(`${sitePath}/`);
      if (target && target !== article) targets.add(target);
    });
    article.links = [...targets].map(target => target.path);
    targets.forEach(target => target.backlinks.push(article.path));
  });

  articles.forEach(article => {
    const scored = articles.filter(other => other !== article).map(other => {
      let score = 0;
      if (article.project && other.project === article.project) score += 4;
      else if (article.categories.join('/') && other.categories.join('/') === article.categories.join('/')) score += 3;
      if (article.links.includes(other.path) || other.links.includes(article.path)) score += 3;
      score += other.tags.filter(tag => article.tags.includes(tag)).length;
      return { other, score };
    }).filter(entry => entry.score >= 3);

    article.related = scored
      .sort((a, b) => b.score - a.score || String(b.other.updated).localeCompare(String(a.other.updated)))
      .slice(0, 8)
      .map(entry => entry.other.path);
  });

  articles.sort((a, b) => String(b.updated).localeCompare(String(a.updated)) || a.title.localeCompare(b.title));

  return {
    generated: new Date().toISOString(),
    articles,
    byPath,
    bySource,
    folders: buildFolders(articles, categoryUrls),
    changes: buildChanges(history, bySource, repositoryUrl(locals))
  };
}

function buildFolders(articles, categoryUrls) {
  const root = { name: '', key: '', href: '', children: new Map(), articles: [], count: 0, updated: null };

  articles.forEach(article => {
    let node = root;
    node.count += 1;
    if (!node.updated || article.updated > node.updated) node.updated = article.updated;

    article.categories.forEach((name, index) => {
      if (!node.children.has(name)) {
        const key = article.categories.slice(0, index + 1).join('/');
        node.children.set(name, {
          name, key, href: categoryUrls.get(key) || '', children: new Map(), articles: [], count: 0, updated: null
        });
      }
      node = node.children.get(name);
      node.count += 1;
      if (!node.updated || article.updated > node.updated) node.updated = article.updated;
    });

    node.articles.push(article);
  });

  return root;
}

function changeStatus(change) {
  if (change.code === 'D') return 'deleted';
  if (change.code === 'R') {
    return path.posix.dirname(change.previousPath) === path.posix.dirname(change.path) ? 'renamed' : 'moved';
  }
  return change.code === 'A' || change.code === 'C' ? 'added' : 'modified';
}

function folderOf(filePath, postsDir) {
  const relative = path.posix.relative(postsDir, path.posix.dirname(filePath));
  return relative && relative !== '.' ? relative.split('/') : [];
}

function repositoryUrl(locals) {
  const resources = (locals.data && locals.data.resources) || {};
  return String(resources.repository_url || '').replace(/\/+$/, '');
}

function buildChanges(history, bySource, repository) {

  return history.commits.map(commit => ({
    hash: commit.hash,
    short: commit.hash.slice(0, 7),
    date: commit.date,
    author: commit.author,
    subject: commit.subject,
    commit_url: repository ? `${repository}/commit/${commit.hash}` : '',
    changes: commit.files.map(change => {
      const article = change.code === 'D' ? null : bySource.get(change.currentPath);
      const status = changeStatus(change);
      return {
        status,
        edited: change.code === 'R' && change.similarity < 100,
        title: article ? article.title : historicalTitle(history, change.code === 'D' ? `${commit.hash}^` : commit.hash, change.path),
        path: article ? article.path : null,
        href: article ? article.href : '',
        removed: !article && status !== 'deleted',
        folder: folderOf(change.path, history.postsDir),
        previous_folder: change.previousPath ? folderOf(change.previousPath, history.postsDir) : null
      };
    })
  }));
}

// Strips build-only fields for the public JSON manifest.
function publicArticle(article) {
  const { id, text, markdown, html_links: htmlLinks, ...rest } = article;
  return rest;
}

module.exports = { buildCatalog, repositoryUrl, plainText, publicArticle, sitePathFromHref, anchorFromHref, linksIn, PROJECTS_CATEGORY };

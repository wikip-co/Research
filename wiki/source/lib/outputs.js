'use strict';

// Machine-readable site outputs for agents, scripts and feed readers.

const hexoUtilPath = require.resolve('hexo-util', { paths: [require.resolve('hexo')] });
const { escapeHTML } = require(hexoUtilPath);
const { publicArticle } = require('./catalog');

const FEED_COMMITS = 50;
const CHANGES_COMMITS = 200;

function yamlValue(value) {
  if (Array.isArray(value)) return value.length ? `\n${value.map(item => `  - ${JSON.stringify(item)}`).join('\n')}` : ' []';
  if (typeof value === 'number' || typeof value === 'boolean') return ` ${value}`;
  return ` ${JSON.stringify(String(value))}`;
}

function frontMatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}:${yamlValue(value)}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

function day(value) {
  return value ? String(value).slice(0, 10) : '';
}

function articleMetadata(article) {
  return {
    title: article.title,
    url: article.url,
    source: article.source,
    categories: article.categories,
    project: article.project,
    status: article.status,
    tags: article.tags,
    created: article.created,
    updated: article.updated,
    revisions: article.revisions,
    last_change: article.last_commit ? article.last_commit.subject : '',
    description: article.has_description ? article.description : ''
  };
}

function articleMarkdown(article) {
  return `${frontMatter(articleMetadata(article))}\n# ${article.title}\n\n${article.markdown.trim()}\n`;
}

function groupedArticles(catalog) {
  const groups = new Map();
  [...catalog.articles]
    .sort((a, b) => a.categories.join('/').localeCompare(b.categories.join('/')) || Number(b.overview) - Number(a.overview) || a.title.localeCompare(b.title))
    .forEach(article => {
      const key = article.categories.join(' / ') || 'Uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(article);
    });
  return groups;
}

function llmsIndex(catalog, config, siteUrl) {
  const lines = [
    `# ${config.title}`,
    '',
    `> ${config.description}`,
    '',
    `Generated ${catalog.generated.slice(0, 10)} from ${catalog.articles.length} articles. Append \`index.md\` to any article URL for its Markdown source with metadata. Machine-readable manifest: ${siteUrl}/api/articles.json. Recent changes: ${siteUrl}/api/changes.json. All articles in one file: ${siteUrl}/llms-full.txt.`,
    '',
    'Articles under "Active Projects" track one project each (research, decisions, meeting notes, status). Other folders hold reusable how-to and reference guides. Check each article\'s `updated` date and status before relying on it.',
    ''
  ];

  groupedArticles(catalog).forEach((articles, group) => {
    lines.push(`## ${group}`, '');
    articles.forEach(article => {
      const notes = [`updated ${day(article.updated)}`];
      if (article.status) notes.unshift(article.status);
      if (article.overview) notes.unshift('overview');
      lines.push(`- [${article.title}](${article.url}index.md): ${article.description} (${notes.join('; ')})`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

function llmsFull(catalog, config) {
  const parts = [`# ${config.title}: all articles\n\nGenerated ${catalog.generated}. Each article starts with its metadata block.\n`];
  groupedArticles(catalog).forEach(articles => {
    articles.forEach(article => parts.push(articleMarkdown(article)));
  });
  return parts.join('\n\n');
}

function searchIndex(catalog) {
  return catalog.articles.map(article => ({
    title: article.title,
    href: article.href,
    categories: article.categories,
    tags: article.tags,
    status: article.status,
    description: article.description,
    headings: article.headings.map(heading => ({ id: heading.id, text: heading.text })),
    created: article.created,
    updated: article.updated,
    text: article.text
  }));
}

function changesJson(catalog, siteUrl) {
  return catalog.changes.slice(0, CHANGES_COMMITS).map(commit => ({
    ...commit,
    changes: commit.changes.map(change => ({ ...change, url: change.path ? `${siteUrl}/${change.path}` : '' }))
  }));
}

function changeLabel(change) {
  const labels = { added: 'New', modified: 'Updated', moved: 'Moved', renamed: 'Renamed', deleted: 'Removed' };
  return labels[change.status] || 'Updated';
}

function atomFeed(catalog, config, siteUrl) {
  const commits = catalog.changes.slice(0, FEED_COMMITS);
  const updated = commits.length ? commits[0].date : catalog.generated;
  const entries = commits.map(commit => {
    const items = commit.changes.map(change => {
      const title = change.href
        ? `<a href="${escapeHTML(`${siteUrl}/${change.path}`)}">${escapeHTML(change.title)}</a>`
        : escapeHTML(change.title);
      return `<li><strong>${changeLabel(change)}</strong>: ${title} <small>(${escapeHTML(change.folder.join(' / '))})</small></li>`;
    }).join('');
    const link = commit.changes.find(change => change.path);
    const href = link ? `${siteUrl}/${link.path}` : commit.commit_url || `${siteUrl}/`;
    return [
      '  <entry>',
      `    <id>${escapeHTML(commit.commit_url || `${siteUrl}/#${commit.hash}`)}</id>`,
      `    <title>${escapeHTML(commit.subject)}</title>`,
      `    <link href="${escapeHTML(href)}"/>`,
      `    <updated>${commit.date}</updated>`,
      `    <author><name>${escapeHTML(commit.author)}</name></author>`,
      `    <content type="html">${escapeHTML(`<ul>${items}</ul>`)}</content>`,
      '  </entry>'
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeHTML(config.title)}: recent changes</title>`,
    `  <id>${siteUrl}/changes.xml</id>`,
    `  <link href="${siteUrl}/changes.xml" rel="self"/>`,
    `  <link href="${siteUrl}/"/>`,
    `  <updated>${updated}</updated>`,
    ...entries,
    '</feed>',
    ''
  ].join('\n');
}

function routes(catalog, config) {
  const siteUrl = String(config.url || '').replace(/\/+$/, '');
  const output = [
    { path: 'llms.txt', data: llmsIndex(catalog, config, siteUrl) },
    { path: 'llms-full.txt', data: llmsFull(catalog, config) },
    { path: 'search.json', data: JSON.stringify(searchIndex(catalog)) },
    { path: 'changes.xml', data: atomFeed(catalog, config, siteUrl) },
    {
      path: 'api/articles.json',
      data: JSON.stringify({
        site: { title: config.title, url: `${siteUrl}/`, generated: catalog.generated },
        articles: catalog.articles.map(publicArticle)
      }, null, 2)
    },
    { path: 'api/changes.json', data: JSON.stringify(changesJson(catalog, siteUrl), null, 2) }
  ];

  catalog.articles.forEach(article => {
    output.push({ path: `${article.path}index.md`, data: articleMarkdown(article) });
  });

  return output;
}

module.exports = { routes, articleMarkdown, articleMetadata, groupedArticles, changeLabel };

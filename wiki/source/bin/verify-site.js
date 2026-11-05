#!/usr/bin/env node
'use strict';

// Inspect generated artifacts, independent of the sample article names.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const hexoUtilPath = require.resolve('hexo-util', { paths: [require.resolve('hexo')] });
const { unescapeHTML } = require(hexoUtilPath);

const output = path.resolve(process.argv[2] || path.join(__dirname, '../../docs'));
const read = file => fs.readFileSync(path.join(output, file), 'utf8');
const exists = file => fs.existsSync(path.join(output, file));

for (const file of ['index.html', 'search.xml', 'search.json', 'llms.txt', 'llms-full.txt', 'changes.xml', 'api/articles.json', 'api/changes.json', '.nojekyll']) {
  assert(exists(file), `Missing output: ${file}`);
}
const manifest = JSON.parse(read('api/articles.json'));
const site = new URL(manifest.site.url);
const root = site.pathname;
const articles = manifest.articles;
const search = JSON.parse(read('search.json'));
assert.equal(search.length, articles.length, 'Search and catalog disagree');
assert(articles.length > 0, 'No articles were published');
for (const article of articles) {
  assert(article.title && article.description && article.tags.length, `Incomplete metadata: ${article.title}`);
  assert(Number.isFinite(Date.parse(article.updated)), `Invalid update date: ${article.title}`);
  assert(exists(`${article.path}index.html`), `Missing HTML: ${article.path}`);
  assert(exists(`${article.path}index.md`), `Missing Markdown: ${article.path}`);
  assert(read('llms.txt').includes(article.title), `Agent index omits: ${article.title}`);
}

let pages = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(full);
    else if (entry.name.endsWith('.html')) {
      pages++;
      const html = fs.readFileSync(full, 'utf8');
      const relative = path.relative(output, full).split(path.sep).join('/');
      assert(!html.includes('{% site_link') && !html.includes('{% post_link'), `Unrendered tag: ${relative}`);
      for (const [, encoded] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const href = unescapeHTML(encoded);
        if (!href || href.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
        const target = new URL(href, new URL(relative, site));
        assert(target.pathname.startsWith(root), `Link escapes configured root: ${relative}: ${href}`);
        const file = decodeURIComponent(target.pathname.slice(root.length));
        const candidate = path.resolve(output, file);
        assert(candidate === output || candidate.startsWith(`${output}${path.sep}`), `Link escapes output: ${href}`);
        assert(exists(file) && (fs.statSync(candidate).isFile() || exists(`${file.replace(/\/$/, '')}/index.html`)), `Missing target: ${relative}: ${href}`);
      }
    }
  }
}
visit(output);
console.log(`Verified ${articles.length} articles, matching search/agent exports, and local links/assets across ${pages} HTML pages (root: ${root}).`);

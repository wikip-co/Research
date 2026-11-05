#!/usr/bin/env node
'use strict';

// Configure a fork without changing article URLs or hand-editing YAML syntax.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const HELP = `Configure this wiki (local files only):
  node source/bin/setup.js --repository https://github.com/TEAM/REPO \\
    --site-url http://wiki.internal:8080 --title "Team Wiki" --author "Team"

Required: --repository, --site-url
Optional: --title, --author, --description, --timezone, --branch, --dry-run
The site URL determines root automatically, including / for a dedicated LAN host.
No Git changes, network requests, commits or deployments are performed.`;

function webUrl(value, label) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must be an HTTP(S) URL without credentials, query or fragment.`);
  }
  return url;
}

function replaceScalar(yaml, key, value) {
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (!pattern.test(yaml)) throw new Error(`Missing configuration key: ${key}`);
  return yaml.replace(pattern, () => `${key}: ${JSON.stringify(value)}`);
}

function configure(base, options) {
  if (!options.repository || !options['site-url']) throw new Error(HELP);
  const repository = webUrl(options.repository, 'Repository');
  if (repository.pathname.split('/').filter(Boolean).length !== 2) {
    throw new Error('Repository must have the form https://HOST/OWNER/REPOSITORY.');
  }
  const site = webUrl(options['site-url'], 'Site URL');
  if (options.timezone) new Intl.DateTimeFormat('en', { timeZone: options.timezone });
  const root = `${site.pathname.replace(/\/+$/, '')}/`;
  const url = `${site.origin}${root === '/' ? '' : root.slice(0, -1)}`;
  const settings = { url, root };
  for (const key of ['title', 'author', 'description', 'timezone']) {
    if (options[key] !== undefined) settings[key] = options[key];
  }
  const files = new Map();
  const configPath = path.join(base, '_config.yml');
  let config = fs.readFileSync(configPath, 'utf8');
  for (const [key, value] of Object.entries(settings)) config = replaceScalar(config, key, value);
  files.set(configPath, config);
  const resourcesPath = path.join(base, 'content/_data/resources.yml');
  let resources = fs.readFileSync(resourcesPath, 'utf8');
  resources = replaceScalar(resources, 'repository_url', repository.href.replace(/\/+$/, '').replace(/\.git$/, ''));
  if (options.branch !== undefined) resources = replaceScalar(resources, 'branch', options.branch);
  files.set(resourcesPath, resources);
  if (!options['dry-run']) {
    for (const [file, content] of files) fs.writeFileSync(file, content);
    // Hexo caches rendered link destinations. A new URL/root must rerender
    // articles even when their Markdown source has not changed.
    fs.rmSync(path.join(base, 'db.json'), { force: true });
  }
  return { files, url, root };
}

if (require.main === module) {
  try {
    const { values } = parseArgs({ options: Object.fromEntries([
      'repository', 'site-url', 'title', 'author', 'description', 'timezone', 'branch'
    ].map(key => [key, { type: 'string' }]).concat([
      ['help', { type: 'boolean' }], ['dry-run', { type: 'boolean' }]
    ])) });
    if (values.help) console.log(HELP);
    else {
      const result = configure(path.resolve(__dirname, '..'), values);
      console.log(`${values['dry-run'] ? 'Would configure' : 'Configured'} ${result.url}/ (root: ${result.root})`);
      for (const file of result.files.keys()) console.log(path.relative(process.cwd(), file));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { configure };

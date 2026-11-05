'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { configure } = require('../bin/setup');

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wiki-setup-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  fs.mkdirSync(path.join(base, 'content/_data'), { recursive: true });
  for (const file of ['_config.yml', 'content/_data/resources.yml']) {
    fs.copyFileSync(path.join(__dirname, '..', file), path.join(base, file));
  }
  return base;
}

test('fork configuration keeps a nested Pages prefix and quotes YAML scalars', t => {
  const base = fixture(t);
  const result = configure(base, {
    repository: 'https://github.example.com/research/handbook.git',
    'site-url': 'https://github.example.com/pages/research/handbook/',
    title: 'Research: notes #1', author: 'Team "$&"', branch: 'published', timezone: 'UTC'
  });
  assert.equal(result.root, '/pages/research/handbook/');
  const config = fs.readFileSync(path.join(base, '_config.yml'), 'utf8');
  assert(config.includes('title: "Research: notes #1"'));
  assert(config.includes(`author: ${JSON.stringify('Team "$&"')}`));
  const resources = fs.readFileSync(path.join(base, 'content/_data/resources.yml'), 'utf8');
  assert(resources.includes('repository_url: "https://github.example.com/research/handbook"'));
  assert(resources.includes('branch: "published"'));
});

test('custom domains use the root path and retain unspecified settings', t => {
  const base = fixture(t);
  const before = fs.readFileSync(path.join(base, '_config.yml'), 'utf8');
  const result = configure(base, { repository: 'https://github.com/team/wiki', 'site-url': 'https://kb.example.org/' });
  assert.equal(result.root, '/');
  const after = fs.readFileSync(path.join(base, '_config.yml'), 'utf8');
  assert(after.includes('url: "https://kb.example.org"'));
  assert.equal(after.match(/^title:.*$/m)[0], before.match(/^title:.*$/m)[0]);
});

test('dry-run computes both configurations without writing files', t => {
  const base = fixture(t);
  const before = fs.readFileSync(path.join(base, '_config.yml'), 'utf8');
  const result = configure(base, { repository: 'https://github.com/team/wiki', 'site-url': 'https://team.github.io/wiki', 'dry-run': true });
  assert.equal(result.root, '/wiki/');
  assert.equal(result.files.size, 2);
  assert.equal(fs.readFileSync(path.join(base, '_config.yml'), 'utf8'), before);
});

test('invalid URL or timezone input leaves both files untouched', t => {
  const base = fixture(t);
  const config = fs.readFileSync(path.join(base, '_config.yml'), 'utf8');
  const resources = fs.readFileSync(path.join(base, 'content/_data/resources.yml'), 'utf8');
  const valid = { repository: 'https://github.com/team/wiki', 'site-url': 'https://team.github.io/wiki' };
  for (const invalid of [
    { repository: 'https://name:password@github.com/team/wiki' },
    { repository: 'https://github.com/team/wiki/tree/main' },
    { 'site-url': 'file:///tmp/wiki' },
    { 'site-url': 'https://example.org/wiki?test=true' },
    { timezone: 'Invalid/Timezone' }
  ]) assert.throws(() => configure(base, { ...valid, ...invalid }));
  assert.equal(fs.readFileSync(path.join(base, '_config.yml'), 'utf8'), config);
  assert.equal(fs.readFileSync(path.join(base, 'content/_data/resources.yml'), 'utf8'), resources);
});

test('applying a site-address change invalidates cached URLs; dry-run preserves them', t => {
  const base = fixture(t);
  const cache = path.join(base, 'db.json');
  fs.writeFileSync(cache, '{"cached_url":"http://old.example/wiki/"}');
  const options = { repository: 'https://github.com/team/wiki', 'site-url': 'http://new.internal' };
  configure(base, { ...options, 'dry-run': true });
  assert(fs.existsSync(cache));
  configure(base, options);
  assert(!fs.existsSync(cache));
});

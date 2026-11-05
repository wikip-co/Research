#!/usr/bin/env node
'use strict';

// Entry point for the wiki CLI that keeps stdout clean (no Hexo INFO logs), so
// `--json` output can be piped straight into other tools. Works from any
// directory: `node source/bin/wiki.js context "Project Name"`.
// The same commands are available as `npx hexo wiki ...` from source/.

const path = require('node:path');
const { parseArgs } = require('node:util');
const Hexo = require('hexo');

// Exit quietly when output is piped into a command that stops reading (head, grep -m).
process.stdout.on('error', error => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean' },
    list: { type: 'boolean' },
    all: { type: 'boolean' },
    strict: { type: 'boolean' },
    'dry-run': { type: 'boolean' },
    debug: { type: 'boolean' },
    limit: { type: 'string' },
    days: { type: 'string' },
    title: { type: 'string' },
    project: { type: 'string' },
    category: { type: 'string' },
    tags: { type: 'string' },
    description: { type: 'string' },
    file: { type: 'string' },
    base: { type: 'string' }
  }
});

(async () => {
  const hexo = new Hexo(path.resolve(__dirname, '..'), { silent: !values.debug, debug: Boolean(values.debug) });
  await hexo.init();
  await hexo.call('wiki', { _: positionals, ...values });
  await hexo.exit();
})().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});

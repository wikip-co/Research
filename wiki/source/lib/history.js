'use strict';

// Derives article dates, revision counts and the site-wide change feed from Git.
//
// Hexo would otherwise date articles by file birth time, which differs between a
// local checkout and the publishing runner. Git history is the same everywhere
// the full history is available (the publishing workflow checks out with
// fetch-depth: 0). Explicit `date` or `updated` front matter still wins.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const moment = require(require.resolve('moment', { paths: [require.resolve('hexo')] }));

const FIELD = '\x1f';
const RECORD = '\x1e';

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function frontMatterValue(raw, key) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw || '');
  if (!block) return '';
  const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(block[1]);
  return match ? match[1].trim().replace(/^(['"])(.*)\1$/, '$2') : '';
}

function parseLog(output) {
  return output.split(RECORD).filter(record => record.trim()).map(record => {
    const [header, ...lines] = record.replace(/^\n+/, '').split('\n');
    const [hash, author, date, subject] = header.split(FIELD);
    const files = lines.filter(Boolean).map(line => {
      const [status, first, second] = line.split('\t');
      const code = status.charAt(0);
      return code === 'R'
        ? { code, similarity: Number(status.slice(1)), previousPath: first, path: second }
        : { code, path: first };
    });
    return { hash, author, date, subject, files };
  }).filter(commit => commit.files.length);
}

function readHistory(hexo) {
  const empty = { available: false, repoRoot: '', files: new Map(), commits: [], dirty: new Set() };
  let repoRoot;

  try {
    repoRoot = git(['rev-parse', '--show-toplevel'], hexo.base_dir).trim();
  } catch (error) {
    hexo.log.warn('Git history is unavailable; article dates fall back to file times.');
    return empty;
  }

  const postsDir = toPosix(path.relative(repoRoot, path.join(hexo.source_dir, '_posts')));
  let commits = [];
  let hasHead = false;
  try {
    git(['rev-parse', '--verify', 'HEAD'], repoRoot);
    hasHead = true;
  } catch (error) {
    // A new template repository has no commits yet. Still inspect local files
    // below so source paths and uncommitted-change badges remain available.
  }

  try {
    if (hasHead) commits = parseLog(git([
      '-c', 'core.quotePath=false',
      'log', '-M', '--name-status', '--no-merges',
      `--format=${RECORD}%H${FIELD}%an${FIELD}%aI${FIELD}%s`,
      '--', postsDir
    ], repoRoot));
  } catch (error) {
    hexo.log.warn(`Unable to read Git history: ${error.message}`);
    return empty;
  }

  if (git(['rev-parse', '--is-shallow-repository'], repoRoot).trim() === 'true') {
    hexo.log.warn('Shallow Git clone: article creation dates and revision counts may be incomplete.');
  }

  // Walk newest to oldest, following renames back to each file's current path.
  const aliases = new Map();
  const files = new Map();

  for (const commit of commits) {
    for (const change of commit.files) {
      const current = aliases.get(change.path) || change.path;
      if (change.code === 'R') aliases.set(change.previousPath, current);
      change.currentPath = current;

      // A move with identical content (R100) appears in the feed but is not a revision.
      const contentChange = !(change.code === 'R' && change.similarity === 100);
      let info = files.get(current);
      if (!info) {
        info = { updated: null, created: commit.date, revisions: 0, last: null };
        files.set(current, info);
      }
      if (contentChange) {
        if (!info.updated) {
          info.updated = commit.date;
          info.last = commit;
        }
        info.revisions += 1;
      }
      info.created = commit.date;
    }
  }

  files.forEach(info => {
    if (!info.updated) {
      info.updated = info.created;
    }
  });

  const dirty = new Set();
  try {
    git(['-c', 'core.quotePath=false', 'status', '--porcelain', '--untracked-files=all', '--', postsDir], repoRoot)
      .split('\n')
      .filter(Boolean)
      .forEach(line => dirty.add(line.slice(3).replace(/^.* -> /, '').replace(/^"(.*)"$/, '$1')));
  } catch (error) {
    // Uncommitted-change markers are a local preview convenience only.
  }

  return { available: true, repoRoot, postsDir, files, commits, dirty };
}

// Looks up an article's title as it was at a given commit (used for deleted or
// since-moved files that no longer exist in the working tree).
function historicalTitle(history, hash, filePath) {
  const cacheKey = `${hash}:${filePath}`;
  history.titles = history.titles || new Map();
  if (!history.titles.has(cacheKey)) {
    let title = '';
    try {
      title = frontMatterValue(git(['show', `${hash}:${filePath}`], history.repoRoot), 'title');
    } catch (error) {
      title = '';
    }
    history.titles.set(cacheKey, title || path.basename(filePath, path.extname(filePath)));
  }
  return history.titles.get(cacheKey);
}

// Applies Git-derived dates and revision metadata to every post. Registered as
// a before_generate filter so it runs for builds, the dev server and CLI loads.
async function applyGitHistory(hexo) {
  const history = readHistory(hexo);
  hexo.wikiHistory = history;

  const Post = hexo.model('Post');
  const saves = Post.toArray().map(post => {
    const relative = history.repoRoot ? toPosix(path.relative(history.repoRoot, post.full_source)) : '';
    const info = history.files.get(relative);
    const dirty = history.dirty.has(relative);
    const explicitDate = frontMatterValue(post.raw, 'date');
    const explicitUpdated = frontMatterValue(post.raw, 'updated');

    post.repo_path = relative;
    if (info && !explicitDate) post.date = moment(info.created);
    if (dirty && !explicitUpdated) {
      post.updated = moment(fs.statSync(post.full_source).mtime);
      if (!info && !explicitDate) post.date = post.updated.clone();
    } else if (info && !explicitUpdated) {
      post.updated = moment(info.updated);
    }

    post.revisions = info ? info.revisions : 0;
    post.last_commit = info && info.last ? {
      hash: info.last.hash,
      author: info.last.author,
      date: info.last.date,
      subject: info.last.subject
    } : null;
    post.uncommitted = dirty;
    return post.save();
  });

  await Promise.all(saves);
  return history;
}

module.exports = { applyGitHistory, frontMatterValue, historicalTitle, toPosix };

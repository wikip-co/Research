// Browser-side presentation for Git-derived dates. The site is static and only
// rebuilt on publish, so anything relative to "now" is computed here.
(function initializeWikiUi() {
  'use strict';

  const DAY = 86400000;
  const recentDays = Number(document.body.dataset.recentDays) || 7;
  const now = Date.now();

  function storage(kind) {
    try {
      return window[kind];
    } catch (error) {
      return null;
    }
  }

  function read(kind, key) {
    try {
      return storage(kind)?.getItem(key) || null;
    } catch (error) {
      return null;
    }
  }

  function save(kind, key, value) {
    try {
      storage(kind)?.setItem(key, value);
    } catch (error) {
      // Private browsing or blocked storage: the feature degrades silently.
    }
  }

  function age(milliseconds, short) {
    const units = [
      ['year', 365 * DAY, 'y'],
      ['month', 30 * DAY, 'mo'],
      ['week', 7 * DAY, 'w'],
      ['day', DAY, 'd'],
      ['hour', 3600000, 'h'],
      ['minute', 60000, 'm']
    ];
    for (const [name, size, abbreviation] of units) {
      const count = Math.floor(milliseconds / size);
      if (count >= 1) return short ? `${count}${abbreviation}` : `${count} ${name}${count === 1 ? '' : 's'}`;
    }
    return short ? 'now' : 'moments';
  }

  const startOfToday = new Date(now).setHours(0, 0, 0, 0);

  // Long labels count calendar days ("yesterday", "3 days ago") so they match
  // the dates shown beside them; short labels use elapsed time ("2d").
  function relative(timestamp, short) {
    const elapsed = now - timestamp;
    if (elapsed < 60000) return short ? 'now' : 'just now';
    if (short) return age(elapsed, true);
    if (timestamp >= startOfToday) return `${age(elapsed, false)} ago`;
    const days = Math.round((startOfToday - new Date(timestamp).setHours(0, 0, 0, 0)) / DAY);
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    return `${age(elapsed, false)} ago`;
  }

  // <time data-relative="">: replace the label; "short": compact label; "append": keep the date.
  document.querySelectorAll('time[data-relative]').forEach(element => {
    const timestamp = Date.parse(element.getAttribute('datetime'));
    if (Number.isNaN(timestamp)) return;
    const mode = element.dataset.relative;
    if (mode === 'append') element.textContent = `${element.textContent} (${relative(timestamp, false)})`;
    else element.textContent = relative(timestamp, mode === 'short');
  });

  // "New" / "Updated" badges for recent changes.
  document.querySelectorAll('.fresh-badge').forEach(badge => {
    const created = Date.parse(badge.dataset.created || '');
    const updated = Date.parse(badge.dataset.updated || '');
    const span = recentDays * DAY;
    if (!Number.isNaN(created) && now - created < span) {
      badge.textContent = 'New';
      badge.classList.add('fresh-new');
    } else if (!Number.isNaN(updated) && now - updated < span) {
      badge.textContent = 'Updated';
      badge.classList.add('fresh-updated');
    } else {
      return;
    }
    badge.title = `Within the last ${recentDays} days`;
    badge.hidden = false;
  });

  document.querySelectorAll('.stale-notice').forEach(notice => {
    const updated = Date.parse(notice.dataset.updated || '');
    const limit = Number(notice.dataset.staleDays) * DAY;
    if (Number.isNaN(updated) || !limit || now - updated < limit) return;
    notice.querySelector('[data-stale-age]').textContent = age(now - updated, false);
    notice.hidden = false;
  });

  document.querySelectorAll('[data-updated-since]').forEach(element => {
    const limit = Number(element.dataset.updatedSince) * DAY;
    const dates = (element.dataset.dates || '').split(',').map(Date.parse).filter(value => !Number.isNaN(value));
    element.textContent = String(dates.filter(value => now - value < limit).length);
  });

  initializeChangeFeed();
  initializeArticleTables();

  function initializeChangeFeed() {
    const feed = document.querySelector('.home-changes');
    if (!feed) return;

    const commits = Array.from(feed.querySelectorAll('.change-commit'));
    const showOlder = document.getElementById('show-older-changes');
    const empty = feed.querySelector('.change-filter-empty');
    let filter = 'all';
    let expanded = false;

    // Highlight changes since the previous visit. The marker is fixed for the
    // whole browser session so reloading the page does not clear it.
    let previousVisit = read('sessionStorage', 'wiki:previousVisit');
    if (previousVisit === null) {
      previousVisit = read('localStorage', 'wiki:lastVisit') || '';
      save('sessionStorage', 'wiki:previousVisit', previousVisit);
    }
    save('localStorage', 'wiki:lastVisit', new Date(now).toISOString());

    const since = Date.parse(previousVisit);
    if (!Number.isNaN(since)) {
      const unseen = commits.filter(commit => Date.parse(commit.dataset.date) > since);
      unseen.forEach(commit => commit.classList.add('is-unseen'));
      const note = feed.querySelector('.last-visit');
      note.textContent = unseen.length
        ? `${unseen.length} change${unseen.length === 1 ? '' : 's'} since your last visit ${relative(since, false)} (marked in blue).`
        : `No changes since your last visit ${relative(since, false)}.`;
      note.hidden = false;
    }

    function render() {
      let visibleCount = 0;
      commits.forEach(commit => {
        const items = Array.from(commit.querySelectorAll('.change'));
        items.forEach(item => {
          item.hidden = filter !== 'all' && item.dataset.status !== filter;
        });
        const matches = items.some(item => !item.hidden);
        const overflow = commit.hasAttribute('data-overflow') && !expanded && filter === 'all';
        commit.hidden = !matches || overflow;
        if (!commit.hidden) visibleCount += 1;
      });
      feed.querySelectorAll('.change-day').forEach(day => {
        day.hidden = !Array.from(day.querySelectorAll('.change-commit')).some(commit => !commit.hidden);
      });
      empty.hidden = visibleCount > 0;
      if (showOlder) showOlder.hidden = expanded || filter !== 'all';
    }

    feed.querySelectorAll('[data-change-filter]').forEach(button => {
      button.addEventListener('click', () => {
        filter = button.dataset.changeFilter;
        feed.querySelectorAll('[data-change-filter]').forEach(other => {
          other.setAttribute('aria-pressed', String(other === button));
        });
        render();
      });
    });

    if (showOlder) {
      showOlder.addEventListener('click', () => {
        expanded = true;
        render();
      });
    }
  }

  function initializeArticleTables() {
    document.querySelectorAll('table[data-sortable]').forEach(table => {
      const body = table.tBodies[0];
      const headers = Array.from(table.tHead.rows[0].cells);
      const panel = table.closest('.article-table-panel');
      const filter = panel && panel.querySelector('#article-table-filter');
      const count = panel && panel.querySelector('[data-table-count]');

      headers.forEach((header, column) => {
        const button = header.querySelector('button');
        if (!button) return;
        button.addEventListener('click', () => {
          const descending = header.getAttribute('aria-sort') !== 'descending';
          headers.forEach(other => other.removeAttribute('aria-sort'));
          header.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
          const numeric = header.dataset.sort === 'number';
          const rows = Array.from(body.rows).sort((a, b) => {
            const left = a.cells[column].dataset.value || '';
            const right = b.cells[column].dataset.value || '';
            const order = numeric ? Number(left) - Number(right) : left.localeCompare(right);
            return descending ? -order : order;
          });
          body.append(...rows);
        });
      });

      if (filter) {
        filter.addEventListener('input', () => {
          const terms = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
          let shown = 0;
          Array.from(body.rows).forEach(row => {
            row.hidden = !terms.every(term => row.dataset.search.includes(term));
            if (!row.hidden) shown += 1;
          });
          if (count) count.textContent = String(shown);
        });
      }
    });
  }
})();

(function initializeLocalSearch() {
  'use strict';

  const RESULT_LIMIT = 50;
  const DAY = 86400000;

  function renderMessage(container, message) {
    const status = document.createElement('p');
    status.className = 'local-search-empty';
    status.textContent = message;
    container.replaceChildren(status);
  }

  function safeResultUrl(value) {
    try {
      const url = new URL(value, document.baseURI);
      return url.origin === window.location.origin ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function appendHighlighted(parent, segments) {
    segments.forEach(segment => {
      if (segment.match) {
        const mark = document.createElement('mark');
        mark.textContent = segment.text;
        parent.append(mark);
      } else {
        parent.append(document.createTextNode(segment.text));
      }
    });
  }

  function relativeDays(value) {
    const timestamp = Date.parse(value || '');
    if (Number.isNaN(timestamp)) return '';
    const days = Math.floor((Date.now() - timestamp) / DAY);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 60) return `${days} days ago`;
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  function metadataLine(entry) {
    const metadata = document.createElement('div');
    metadata.className = 'search-result-meta';
    const parts = [];
    if (entry.categories.length) parts.push(['categories', entry.categories.join(' › ')]);
    if (entry.updated) parts.push(['updated', `updated ${relativeDays(entry.updated)}`]);
    if (entry.status) parts.push(['status', entry.status]);
    if (entry.tags.length) parts.push(['tags', entry.tags.join(', ')]);
    parts.forEach(([className, text]) => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      metadata.append(span);
    });
    return metadata;
  }

  function renderResults(container, entries, input) {
    const query = window.WikiSearch.parseQuery(input);
    const highlightTerms = query.terms.concat(query.filters.filter(filter => filter.field !== 'tags' && !filter.negated).map(filter => filter.value));
    const results = window.WikiSearch.search(entries, query);

    if (!results.length) {
      renderMessage(container, 'No results found.');
      return;
    }

    const summary = document.createElement('p');
    summary.className = 'search-summary';
    summary.textContent = results.length > RESULT_LIMIT
      ? `Showing the best ${RESULT_LIMIT} of ${results.length} results.`
      : `${results.length} result${results.length === 1 ? '' : 's'}, best match first.`;

    const list = document.createElement('ul');
    list.className = 'search-result-list';

    results.slice(0, RESULT_LIMIT).forEach(result => {
      const entry = result.entry;
      const resultUrl = safeResultUrl(entry.href);
      if (!resultUrl) return;

      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'search-result-title';
      link.href = resultUrl;
      appendHighlighted(link, window.WikiSearch.highlight(entry.title, highlightTerms));
      item.append(link, metadataLine(entry));

      if (result.section) {
        const section = document.createElement('a');
        section.className = 'search-result-section';
        section.href = `${resultUrl}#${encodeURIComponent(result.section.id)}`;
        section.textContent = `§ ${result.section.text}`;
        item.append(section);
      }

      const excerpt = document.createElement('p');
      excerpt.className = 'search-result-snippet';
      appendHighlighted(excerpt, window.WikiSearch.snippet(entry.text || entry.description, highlightTerms, 220));
      item.append(excerpt);
      list.append(item);
    });

    container.replaceChildren(summary, list);
  }

  function debounce(callback, delay) {
    let timeout;

    return function debounced(...args) {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => callback.apply(this, args), delay);
    };
  }

  function startSearch() {
    const input = document.getElementById('local-search-input');
    const results = document.getElementById('local-search-result');
    const help = document.getElementById('search-help');

    if (!input || !results || !window.WikiSearch) {
      return;
    }

    const indexUrl = input.dataset.searchIndex;
    let entries = null;
    let loading = null;

    // The index is fetched on first use rather than on every page load.
    function loadIndex() {
      if (!loading) {
        results.setAttribute('aria-busy', 'true');
        renderMessage(results, 'Loading search index...');
        loading = window.fetch(indexUrl, { headers: { Accept: 'application/json' } })
          .then(response => {
            if (!response.ok) {
              throw new Error(response.status === 404 ? 'Search index not found.' : `Search index request failed (${response.status}).`);
            }
            return response.json();
          })
          .then(data => {
            entries = data;
            results.replaceChildren();
          })
          .catch(error => {
            loading = null;
            renderMessage(results, error.message || 'Search is temporarily unavailable.');
          })
          .finally(() => results.removeAttribute('aria-busy'));
      }
      return loading;
    }

    function syncUrl(value) {
      const url = new URL(window.location.href);
      if (value) url.searchParams.set('q', value);
      else url.searchParams.delete('q');
      window.history.replaceState(window.history.state, '', url);
    }

    const update = debounce(() => {
      const value = input.value.trim();
      syncUrl(value);
      if (!value) {
        results.replaceChildren();
        return;
      }
      loadIndex().then(() => {
        if (entries && input.value.trim() === value) renderResults(results, entries, value);
      });
    }, 150);

    input.addEventListener('focus', () => {
      loadIndex();
      if (help) help.hidden = false;
    }, { once: false });
    input.addEventListener('input', update);

    input.addEventListener('keydown', event => {
      const links = Array.from(results.querySelectorAll('.search-result-title'));
      if (event.key === 'ArrowDown' && links.length) {
        event.preventDefault();
        links[0].focus();
      } else if (event.key === 'Enter' && links.length) {
        event.preventDefault();
        links[0].click();
      } else if (event.key === 'Escape') {
        input.value = '';
        update();
      }
    });

    results.addEventListener('keydown', event => {
      const links = Array.from(results.querySelectorAll('.search-result-title'));
      const index = links.indexOf(document.activeElement);
      if (index === -1) return;
      if (event.key === 'ArrowDown' && index < links.length - 1) {
        event.preventDefault();
        links[index + 1].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        (index ? links[index - 1] : input).focus();
      } else if (event.key === 'Escape') {
        input.focus();
      }
    });

    // "/" focuses search from anywhere except text fields.
    document.addEventListener('keydown', event => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      input.focus();
      input.select();
    });

    const initial = new URL(window.location.href).searchParams.get('q');
    if (initial) {
      input.value = initial;
      update();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSearch, { once: true });
  } else {
    startSearch();
  }
})();

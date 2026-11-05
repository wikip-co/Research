// Ranked article search shared by the browser (window.WikiSearch) and the
// `hexo wiki search` command (module.exports), so both return the same order.
//
// Query syntax:
//   word another      every word must appear (title, headings, tags, folders, text)
//   "exact phrase"    phrase match
//   -word             exclude articles containing the word
//   tag:Snowflake     require a tag (case-insensitive; quote multi-word values)
//   in:"DnA Azure"    require a folder/project path containing the value
//   title:overview    require the title to contain the value
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WikiSearch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WEIGHTS = { title: 12, tags: 8, headings: 6, folders: 5, description: 4, text: 1 };
  const FILTERS = { tag: 'tags', tags: 'tags', in: 'folders', cat: 'folders', category: 'folders', project: 'folders', title: 'title' };

  function normalize(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  function parseQuery(input) {
    const query = { terms: [], excluded: [], filters: [] };
    const pattern = /(-)?(?:([a-z]+):)?(?:"([^"]*)"?|(\S+))/gi;
    let match;

    while ((match = pattern.exec(String(input || '')))) {
      const [, negated, prefix, quoted, bare] = match;
      let value = normalize(quoted !== undefined ? quoted : bare).trim();
      const field = prefix && FILTERS[prefix.toLowerCase()];

      if (prefix && !field) value = normalize(match[0].replace(/^-/, '')).replace(/"/g, '');
      if (!value) continue;

      if (field) query.filters.push({ field, value, negated: Boolean(negated) });
      else if (negated) query.excluded.push(value);
      else query.terms.push(value);
    }
    return query;
  }

  function prepare(entry) {
    if (!entry._search) {
      entry._search = {
        title: normalize(entry.title),
        tags: (entry.tags || []).map(normalize),
        folders: normalize((entry.categories || []).join(' / ')),
        headings: (entry.headings || []).map(heading => normalize(heading.text)),
        description: normalize(entry.description),
        text: normalize(entry.text)
      };
      entry._search.tagText = entry._search.tags.join(' ');
      entry._search.headingText = entry._search.headings.join(' ');
    }
    return entry._search;
  }

  function contains(haystack, term) {
    if (haystack.includes(term)) return true;
    if (/\s/.test(term) && haystack.includes(term.replace(/\s+/g, '-'))) return true;
    // "on-call" should also find "on call"; "oncall ai" should not need hyphens.
    return /[-_/]/.test(term) && term.split(/[-_/]+/).filter(Boolean).every(part => haystack.includes(part));
  }

  function countOccurrences(haystack, term) {
    let count = 0;
    for (let index = haystack.indexOf(term); index !== -1 && count < 20; index = haystack.indexOf(term, index + term.length)) {
      count += 1;
    }
    return count;
  }

  function startsWord(haystack, term) {
    const index = haystack.indexOf(term);
    return index === 0 || (index > 0 && /[^a-z0-9]/.test(haystack.charAt(index - 1)));
  }

  function scoreTerm(fields, term) {
    let score = 0;
    if (contains(fields.title, term)) {
      score += WEIGHTS.title + (startsWord(fields.title, term) ? 4 : 0) + (fields.title === term ? 10 : 0);
    }
    if (fields.tags.some(tag => tag === term)) score += WEIGHTS.tags + 2;
    else if (contains(fields.tagText, term)) score += WEIGHTS.tags;
    if (contains(fields.headingText, term)) score += WEIGHTS.headings;
    if (contains(fields.folders, term)) score += WEIGHTS.folders;
    if (contains(fields.description, term)) score += WEIGHTS.description;
    if (contains(fields.text, term)) score += WEIGHTS.text + Math.min(countOccurrences(fields.text, term), 20) * 0.25;
    return score;
  }

  function passesFilter(fields, filter) {
    let matched;
    if (filter.field === 'tags') matched = fields.tags.some(tag => tag === filter.value) || contains(fields.tagText, filter.value);
    else matched = contains(fields[filter.field], filter.value);
    return filter.negated ? !matched : matched;
  }

  function search(entries, input, options) {
    const settings = options || {};
    const query = typeof input === 'string' ? parseQuery(input) : input;
    if (!query.terms.length && !query.filters.length) return [];

    const results = [];
    entries.forEach(entry => {
      const fields = prepare(entry);
      if (!query.filters.every(filter => passesFilter(fields, filter))) return;
      const everything = [fields.title, fields.tagText, fields.headingText, fields.folders, fields.description, fields.text].join(' ');
      if (query.excluded.some(term => contains(everything, term))) return;

      let score = query.terms.length ? 0 : 1;
      for (const term of query.terms) {
        const termScore = scoreTerm(fields, term);
        if (!termScore) return;
        score += termScore;
      }
      results.push({ entry, score, section: matchingSection(entry, fields, query.terms) });
    });

    results.sort((a, b) => b.score - a.score || String(b.entry.updated || '').localeCompare(String(a.entry.updated || '')));
    return settings.limit ? results.slice(0, settings.limit) : results;
  }

  function matchingSection(entry, fields, terms) {
    if (!terms.length) return null;
    const index = fields.headings.findIndex(heading => terms.some(term => contains(heading, term)));
    return index === -1 ? null : entry.headings[index];
  }

  // Splits text into [{ text, match }] segments; render them as text nodes,
  // never as HTML.
  function highlight(text, terms) {
    const source = String(text || '');
    const lower = source.toLowerCase();
    const needles = (terms || []).filter(Boolean).sort((a, b) => b.length - a.length);
    const segments = [];
    let cursor = 0;

    while (needles.length && cursor < source.length) {
      let next = -1;
      let nextTerm = '';
      needles.forEach(term => {
        const index = lower.indexOf(term, cursor);
        if (index !== -1 && (next === -1 || index < next)) {
          next = index;
          nextTerm = term;
        }
      });
      if (next === -1) break;
      if (next > cursor) segments.push({ text: source.slice(cursor, next), match: false });
      segments.push({ text: source.slice(next, next + nextTerm.length), match: true });
      cursor = next + nextTerm.length;
    }
    if (cursor < source.length) segments.push({ text: source.slice(cursor), match: false });
    return segments;
  }

  // Highlighted segments for a window of text around the first match.
  function snippet(text, terms, length) {
    const size = length || 200;
    const source = String(text || '');
    const lower = source.toLowerCase();
    let position = -1;

    (terms || []).filter(Boolean).forEach(term => {
      const index = lower.indexOf(term);
      if (index !== -1 && (position === -1 || index < position)) position = index;
    });

    let start = position === -1 ? 0 : Math.max(0, position - Math.floor(size / 3));
    let end = Math.min(source.length, start + size);
    if (start > 0) start = source.indexOf(' ', start) + 1 || start;
    if (end < source.length) end = source.lastIndexOf(' ', end) > start ? source.lastIndexOf(' ', end) : end;

    const segments = highlight(source.slice(start, end), terms);
    if (start > 0) segments.unshift({ text: '…', match: false });
    if (end < source.length) segments.push({ text: '…', match: false });
    return segments;
  }

  return { highlight, normalize, parseQuery, search, snippet };
});

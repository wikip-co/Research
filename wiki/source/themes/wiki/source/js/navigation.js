(function initializeNavigation() {
  'use strict';

  const categories = document.getElementById('categories');
  const tags = document.getElementById('tags');
  const indexToggle = document.getElementById('index-toggle');
  const keywordToggle = document.getElementById('keyword-toggle');
  const expandAll = document.getElementById('allExpand');
  const filterInput = document.getElementById('index-filter');
  const sortSelect = document.getElementById('index-sort');
  const emptyMessage = categories && categories.querySelector('.index-empty');
  const SORT_KEY = 'wiki:indexSort';

  if (!categories || !tags || !indexToggle || !keywordToggle || !expandAll) {
    return;
  }

  function setPanel(panel, toggle, visible) {
    panel.hidden = !visible;
    toggle.setAttribute('aria-expanded', String(visible));
  }

  function togglePanel(panel, toggle, otherPanel, otherToggle) {
    const showPanel = panel.hidden;
    setPanel(panel, toggle, showPanel);
    setPanel(otherPanel, otherToggle, false);
    expandAll.hidden = panel !== categories || !showPanel;
    if (panel === categories && showPanel && filterInput) filterInput.focus({ preventScroll: true });
  }

  function childList(directory) {
    return Array.from(directory.children).find(child => child.tagName === 'UL');
  }

  function setDirectoryExpanded(directory, expanded) {
    const toggle = Array.from(directory.children).find(child => child.matches('[data-role="directory"]'));
    const subtree = childList(directory);

    if (!toggle || !subtree) {
      return;
    }

    directory.classList.toggle('open', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    const icon = toggle.querySelector('.fa');

    if (icon) {
      icon.classList.toggle('fa-folder-open', expanded);
      icon.classList.toggle('fa-folder', !expanded);
    }
  }

  indexToggle.addEventListener('click', () => {
    togglePanel(categories, indexToggle, tags, keywordToggle);
  });

  keywordToggle.addEventListener('click', () => {
    togglePanel(tags, keywordToggle, categories, indexToggle);
  });

  categories.addEventListener('click', event => {
    const toggle = event.target.closest('[data-role="directory"]');

    if (!toggle) {
      return;
    }

    const directory = toggle.closest('.directory');
    setDirectoryExpanded(directory, !directory.classList.contains('open'));
  });

  expandAll.addEventListener('click', () => {
    const expanded = expandAll.getAttribute('aria-expanded') !== 'true';
    categories.querySelectorAll('.directory').forEach(directory => {
      setDirectoryExpanded(directory, expanded);
    });
    expandAll.setAttribute('aria-expanded', String(expanded));
    expandAll.setAttribute('aria-label', expanded ? 'Collapse all categories' : 'Expand all categories');
    const icon = expandAll.querySelector('.fa');

    if (icon) {
      icon.classList.toggle('fa-angle-double-up', expanded);
      icon.classList.toggle('fa-angle-double-down', !expanded);
    }
  });

  // Sorting: folders and articles within each folder, by name or by last update.
  function sortTree(mode) {
    categories.querySelectorAll('ul.category-tree').forEach(list => {
      const items = Array.from(list.children).filter(item => item.tagName === 'LI');
      const compare = mode === 'updated'
        ? (a, b) => (b.dataset.updated || '').localeCompare(a.dataset.updated || '')
        : (a, b) => (a.dataset.name || '').localeCompare(b.dataset.name || '');
      const folders = items.filter(item => item.classList.contains('directory')).sort(compare);
      const files = items.filter(item => item.classList.contains('file')).sort(compare);
      list.append(...folders, ...files);
    });
  }

  if (sortSelect) {
    try {
      sortSelect.value = window.localStorage.getItem(SORT_KEY) || 'name';
    } catch (error) {
      sortSelect.value = 'name';
    }
    if (sortSelect.value !== 'name') sortTree(sortSelect.value);
    sortSelect.addEventListener('change', () => {
      sortTree(sortSelect.value);
      try {
        window.localStorage.setItem(SORT_KEY, sortSelect.value);
      } catch (error) {
        // Preference is not remembered when storage is unavailable.
      }
    });
  }

  // Filtering: an article matches on title, tags or status; a folder match shows
  // everything inside it. Matching folders are expanded while a filter is active.
  const initiallyOpen = new Map(Array.from(categories.querySelectorAll('.directory'), directory => [directory, directory.classList.contains('open')]));

  function applyFilter() {
    const terms = filterInput.value.toLowerCase().split(/\s+/).filter(Boolean);

    if (!terms.length) {
      categories.querySelectorAll('.directory, .file').forEach(item => {
        item.hidden = false;
      });
      initiallyOpen.forEach((open, directory) => setDirectoryExpanded(directory, open));
      if (emptyMessage) emptyMessage.hidden = true;
      return;
    }

    const matches = item => terms.every(term => (item.dataset.search || '').includes(term));

    function visit(list, ancestorMatched) {
      let anyVisible = false;
      Array.from(list.children).forEach(item => {
        if (item.classList.contains('file')) {
          item.hidden = !(ancestorMatched || matches(item));
        } else if (item.classList.contains('directory')) {
          const selfMatched = ancestorMatched || matches(item);
          const childVisible = visit(childList(item), selfMatched);
          item.hidden = !(selfMatched || childVisible);
          setDirectoryExpanded(item, childVisible && !item.hidden);
        }
        if (!item.hidden) anyVisible = true;
      });
      return anyVisible;
    }

    const root = categories.querySelector('ul.category-tree');
    const anyVisible = visit(root, false);
    if (emptyMessage) emptyMessage.hidden = anyVisible;
  }

  if (filterInput) {
    filterInput.addEventListener('input', applyFilter);
    filterInput.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        filterInput.value = '';
        applyFilter();
      }
    });
  }

  if (window.location.hash === '#index') {
    togglePanel(categories, indexToggle, tags, keywordToggle);
  }
})();

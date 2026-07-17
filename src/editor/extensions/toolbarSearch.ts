/**
 * @fileoverview Simple search and replace for CodeMirror toolbar.
 * @module editor/extensions/toolbarSearch
 */

import { EditorView, keymap } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import {
  search,
  openSearchPanel,
  closeSearchPanel,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
  getSearchQuery,
  setSearchQuery,
  SearchQuery,
} from '@codemirror/search';

// State to track if search panel is open
export const searchPanelOpen = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setSearchPanelOpen)) return effect.value;
    }
    return value;
  },
});

export const setSearchPanelOpen = StateEffect.define<boolean>();

interface SearchPanelControls {
  dom: HTMLElement;
  searchInput: HTMLInputElement;
  replaceInput: HTMLInputElement;
  caseCb: HTMLInputElement;
  wordCb: HTMLInputElement;
  regexpCb: HTMLInputElement;
  countEl: HTMLSpanElement;
  refreshCount: () => void;
}

// Get selected text from editor (single selection only, not multiple selections)
function getSelectedText(view: EditorView): string | null {
  const selection = view.state.selection.main;
  if (selection.from === selection.to) return null; // No selection
  return view.state.doc.sliceString(selection.from, selection.to);
}

export function openToolbarSearch(view: EditorView): boolean {
  const selectedText = getSelectedText(view);
  const currentQuery = getSearchQuery(view.state);
  
  // Update search query with selected text if there is a selection
  // This also updates when panel is already open with a new selection
  if (selectedText !== null) {
    const newQuery = new SearchQuery({
      search: selectedText,
      caseSensitive: currentQuery.caseSensitive,
      wholeWord: currentQuery.wholeWord,
      regexp: currentQuery.regexp,
      replace: currentQuery.replace,
    });
    view.dispatch({ 
      effects: [
        setSearchQuery.of(newQuery),
        setSearchPanelOpen.of(true)
      ] 
    });
  } else {
    view.dispatch({ effects: setSearchPanelOpen.of(true) });
  }
  
  openSearchPanel(view);
  return true;
}

export function closeToolbarSearch(view: EditorView): boolean {
  view.dispatch({ effects: setSearchPanelOpen.of(false) });
  closeSearchPanel(view);
  return true;
}

export function toggleToolbarSearch(view: EditorView): boolean {
  const isOpen = view.state.field(searchPanelOpen);
  return isOpen ? closeToolbarSearch(view) : openToolbarSearch(view);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchRegex(query: SearchQuery): RegExp | null {
  if (!query.search) return null;

  let source = query.regexp ? query.search : escapeRegExp(query.search);
  if (query.wholeWord) {
    source = `\\b(?:${source})\\b`;
  }

  try {
    return new RegExp(source, query.caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

// Count matches in entire document
function countMatches(view: EditorView, query: SearchQuery): number {
  if (!query.search) return 0;

  const text = view.state.doc.toString();
  const regex = buildSearchRegex(query);
  if (!regex) return 0;

  let count = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    count++;
    if (match[0].length === 0) regex.lastIndex++;
  }

  return count;
}

// Get current match index (1-based)
function getCurrentMatchIndex(view: EditorView, query: SearchQuery): number {
  if (!query.search) return 0;

  const selection = view.state.selection.main;
  const text = view.state.doc.toString();
  const cursorPos = selection.from;

  const regex = buildSearchRegex(query);
  if (!regex) return 0;

  let count = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    count++;
    if (match.index <= cursorPos && cursorPos < match.index + match[0].length) {
      return count;
    }
    if (match[0].length === 0) regex.lastIndex++;
  }

  return 0;
}

function renderMatchCount(view: EditorView, countEl: HTMLSpanElement): void {
  const query = getSearchQuery(view.state);
  if (!query.search) {
    countEl.style.display = 'none';
    countEl.textContent = '';
    return;
  }

  const total = countMatches(view, query);
  if (total <= 0) {
    countEl.textContent = '0/0';
    countEl.style.display = 'inline';
    return;
  }

  const current = getCurrentMatchIndex(view, query);
  countEl.textContent = `${current || 1}/${total}`;
  countEl.style.display = 'inline';
}

function queryEquals(a: SearchQuery, b: SearchQuery): boolean {
  return (
    a.search === b.search &&
    a.replace === b.replace &&
    a.caseSensitive === b.caseSensitive &&
    a.wholeWord === b.wholeWord &&
    a.regexp === b.regexp
  );
}

function applyQueryToControls(query: SearchQuery, controls: SearchPanelControls): void {
  if (document.activeElement !== controls.searchInput) {
    controls.searchInput.value = query.search || '';
  }
  if (document.activeElement !== controls.replaceInput) {
    controls.replaceInput.value = query.replace || '';
  }
  controls.caseCb.checked = query.caseSensitive;
  controls.wordCb.checked = query.wholeWord;
  controls.regexpCb.checked = query.regexp;
}

// Create search panel DOM
function createSearchPanelControls(view: EditorView): SearchPanelControls {
  const dom = document.createElement('div');
  dom.className = 'cm-toolbar-search-panel';
  dom.style.cssText = `
    background-color: var(--ai-toolbar-bg);
    border-bottom: 1px solid var(--ai-toolbar-border);
    padding: 8px 12px;
  `;
  dom.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  const container = document.createElement('div');
  container.className = 'search-container';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  dom.appendChild(container);

  const searchRow = document.createElement('div');
  searchRow.className = 'search-row';
  searchRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  container.appendChild(searchRow);

  const replaceRow = document.createElement('div');
  replaceRow.className = 'replace-row';
  replaceRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  container.appendChild(replaceRow);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Find...';
  searchInput.setAttribute('main-field', 'true');
  searchInput.style.cssText = `
    flex: 1;
    padding: 6px 10px;
    font-size: 14px;
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    background-color: var(--ai-toolbar-input-bg);
    color: var(--ai-toolbar-text);
    outline: none;
  `;
  searchRow.appendChild(searchInput);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'search-btn prev';
  prevBtn.textContent = '^';
  prevBtn.title = 'Previous match (Shift+Enter)';
  prevBtn.setAttribute('aria-label', 'Previous match');
  prevBtn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    background-color: transparent;
    color: var(--ai-toolbar-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  `;
  prevBtn.addEventListener('mouseenter', () => {
    prevBtn.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
    prevBtn.style.borderColor = 'var(--ai-toolbar-active)';
    prevBtn.style.color = 'var(--ai-toolbar-active)';
  });
  prevBtn.addEventListener('mouseleave', () => {
    prevBtn.style.backgroundColor = 'transparent';
    prevBtn.style.borderColor = 'var(--ai-toolbar-input-border)';
    prevBtn.style.color = 'var(--ai-toolbar-text-secondary)';
  });
  searchRow.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'search-btn next';
  nextBtn.textContent = 'v';
  nextBtn.title = 'Next match (Enter)';
  nextBtn.setAttribute('aria-label', 'Next match');
  nextBtn.style.cssText = prevBtn.style.cssText;
  nextBtn.addEventListener('mouseenter', () => {
    nextBtn.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
    nextBtn.style.borderColor = 'var(--ai-toolbar-active)';
    nextBtn.style.color = 'var(--ai-toolbar-active)';
  });
  nextBtn.addEventListener('mouseleave', () => {
    nextBtn.style.backgroundColor = 'transparent';
    nextBtn.style.borderColor = 'var(--ai-toolbar-input-border)';
    nextBtn.style.color = 'var(--ai-toolbar-text-secondary)';
  });
  searchRow.appendChild(nextBtn);

  const countEl = document.createElement('span');
  countEl.className = 'search-match-count';
  countEl.style.cssText = `
    font-size: 12px;
    font-weight: 500;
    color: var(--ai-toolbar-text-muted);
    padding: 0 6px;
  `;
  searchRow.appendChild(countEl);

  const createOption = (
    cssClass: string,
    text: string,
    tooltip: string,
    ariaLabel: string
  ): { label: HTMLLabelElement; input: HTMLInputElement } => {
    const label = document.createElement('label');
    label.className = 'search-option';
    label.title = tooltip;
    label.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 500;
      color: var(--ai-toolbar-text-secondary);
      border: 1px solid var(--ai-toolbar-input-border);
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
    `;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = cssClass;
    input.setAttribute('aria-label', ariaLabel);
    input.title = tooltip;
    input.style.cssText = 'display: none;';

    const span = document.createElement('span');
    span.textContent = text;

    // Update label appearance when checkbox is toggled
    const updateCheckedState = () => {
      const isChecked = input.checked;
      if (isChecked) {
        label.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
        label.style.borderColor = 'var(--ai-toolbar-active)';
        label.style.color = 'var(--ai-toolbar-active)';
        label.style.fontWeight = '700';
      } else {
        // Unchecked state: reset to default
        label.style.backgroundColor = 'transparent';
        label.style.borderColor = 'var(--ai-toolbar-input-border)';
        label.style.color = 'var(--ai-toolbar-text-secondary)';
        label.style.fontWeight = '500';
      }
    };
    input.addEventListener('change', updateCheckedState);

    // Override mouseenter/mouseleave to respect checked state
    label.addEventListener('mouseenter', () => {
      const isChecked = input.checked;
      if (isChecked) {
        label.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
        label.style.borderColor = 'var(--ai-toolbar-active)';
        label.style.color = 'var(--ai-toolbar-active)';
      } else {
        label.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
        label.style.borderColor = 'var(--ai-toolbar-active)';
        label.style.color = 'var(--ai-toolbar-active)';
      }
    });
    label.addEventListener('mouseleave', () => {
      updateCheckedState();
    });

    label.appendChild(input);
    label.appendChild(span);
    return { label, input };
  };

  const caseOption = createOption('case-sensitive', 'Aa', 'Match case', 'Match case');
  const wordOption = createOption('whole-word', 'ab', 'Whole word only', 'Whole word only');
  const regexOption = createOption('regexp', '.*', 'Use regular expression', 'Use regular expression');
  searchRow.appendChild(caseOption.label);
  searchRow.appendChild(wordOption.label);
  searchRow.appendChild(regexOption.label);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'search-btn close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close search (Escape)';
  closeBtn.setAttribute('aria-label', 'Close search');
  closeBtn.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 18px;
    font-weight: 600;
    border: 1px solid var(--ai-toolbar-input-border);
    border-radius: 6px;
    background-color: transparent;
    color: var(--ai-toolbar-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
    closeBtn.style.borderColor = 'var(--ai-toolbar-active)';
    closeBtn.style.color = 'var(--ai-toolbar-active)';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.borderColor = 'var(--ai-toolbar-input-border)';
    closeBtn.style.color = 'var(--ai-toolbar-text-secondary)';
  });
  searchRow.appendChild(closeBtn);

  const replaceInput = document.createElement('input');
  replaceInput.type = 'text';
  replaceInput.className = 'replace-input';
  replaceInput.placeholder = 'Replace...';
  replaceInput.style.cssText = searchInput.style.cssText;
  replaceRow.appendChild(replaceInput);

  const replaceBtn = document.createElement('button');
  replaceBtn.type = 'button';
  replaceBtn.className = 'search-btn replace';
  replaceBtn.textContent = 'Replace';
  replaceBtn.title = 'Replace current match';
  replaceBtn.setAttribute('aria-label', 'Replace current match');
  replaceBtn.style.cssText = prevBtn.style.cssText;
  replaceBtn.addEventListener('mouseenter', () => {
    replaceBtn.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
    replaceBtn.style.borderColor = 'var(--ai-toolbar-active)';
    replaceBtn.style.color = 'var(--ai-toolbar-active)';
  });
  replaceBtn.addEventListener('mouseleave', () => {
    replaceBtn.style.backgroundColor = 'transparent';
    replaceBtn.style.borderColor = 'var(--ai-toolbar-input-border)';
    replaceBtn.style.color = 'var(--ai-toolbar-text-secondary)';
  });
  replaceRow.appendChild(replaceBtn);

  const replaceAllBtn = document.createElement('button');
  replaceAllBtn.type = 'button';
  replaceAllBtn.className = 'search-btn replace-all';
  replaceAllBtn.textContent = 'Replace All';
  replaceAllBtn.title = 'Replace all matches';
  replaceAllBtn.setAttribute('aria-label', 'Replace all matches');
  replaceAllBtn.style.cssText = prevBtn.style.cssText;
  replaceAllBtn.addEventListener('mouseenter', () => {
    replaceAllBtn.style.backgroundColor = 'var(--ai-toolbar-active-bg)';
    replaceAllBtn.style.borderColor = 'var(--ai-toolbar-active)';
    replaceAllBtn.style.color = 'var(--ai-toolbar-active)';
  });
  replaceAllBtn.addEventListener('mouseleave', () => {
    replaceAllBtn.style.backgroundColor = 'transparent';
    replaceAllBtn.style.borderColor = 'var(--ai-toolbar-input-border)';
    replaceAllBtn.style.color = 'var(--ai-toolbar-text-secondary)';
  });
  replaceRow.appendChild(replaceAllBtn);

  const caseCb = caseOption.input;
  const wordCb = wordOption.input;
  const regexpCb = regexOption.input;

  const refreshCount = () => {
    renderMatchCount(view, countEl);
  };

  const syncControlsFromState = () => {
    applyQueryToControls(getSearchQuery(view.state), {
      dom,
      searchInput,
      replaceInput,
      caseCb,
      wordCb,
      regexpCb,
      countEl,
      refreshCount,
    });
  };

  syncControlsFromState();
  setTimeout(() => searchInput.focus(), 0);

  const updateQuery = () => {
    const newQuery = new SearchQuery({
      search: searchInput.value,
      caseSensitive: caseCb.checked,
      wholeWord: wordCb.checked,
      regexp: regexpCb.checked,
      replace: replaceInput.value,
    });
    view.dispatch({ effects: setSearchQuery.of(newQuery) });
    refreshCount();
  };

  [searchInput, replaceInput].forEach(el => el.addEventListener('input', updateQuery));
  [caseCb, wordCb, regexpCb].forEach(el => el.addEventListener('change', updateQuery));

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious(view);
      } else {
        findNext(view);
      }
      view.dispatch({ scrollIntoView: true });
      refreshCount();
    } else if (e.key === 'Escape') {
      closeToolbarSearch(view);
      view.focus();
    }
  });
  
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeToolbarSearch(view);
      view.focus();
    }
  });

  prevBtn.addEventListener('click', () => {
    findPrevious(view);
    view.dispatch({ scrollIntoView: true });
    refreshCount();
  });
  nextBtn.addEventListener('click', () => {
    findNext(view);
    view.dispatch({ scrollIntoView: true });
    refreshCount();
  });
  closeBtn.addEventListener('click', () => { closeToolbarSearch(view); view.focus(); });

  // Replace current match and move to next
  replaceBtn.addEventListener('click', () => {
    replaceNext(view);
    findNext(view);
    refreshCount();
  });

  // Replace all matches
  replaceAllBtn.addEventListener('click', () => {
    replaceAll(view);
    // Clear search to prevent re-replacing
    const currentQuery = getSearchQuery(view.state);
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: '',
          replace: currentQuery.replace,
          caseSensitive: currentQuery.caseSensitive,
          wholeWord: currentQuery.wholeWord,
          regexp: currentQuery.regexp,
        })
      )
    });
    syncControlsFromState();
    refreshCount();
  });

  refreshCount();

  return {
    dom,
    searchInput,
    replaceInput,
    caseCb,
    wordCb,
    regexpCb,
    countEl,
    refreshCount,
  };
}

function createSearchPanel(view: EditorView) {
  const controls = createSearchPanelControls(view);
  return {
    dom: controls.dom,
    top: true,
    update(update: ViewUpdate) {
      const prevQuery = getSearchQuery(update.startState);
      const currentQuery = getSearchQuery(update.state);
      const queryChanged = !queryEquals(prevQuery, currentQuery);

      if (queryChanged) {
        applyQueryToControls(currentQuery, controls);
      }

      if (queryChanged || update.docChanged || update.selectionSet) {
        controls.refreshCount();
      }
    },
    destroy() {
      controls.dom.remove();
    },
  };
}

export function toolbarSearch() {
  return [
    search({
      top: true,
      createPanel: (view) => createSearchPanel(view),
    }),
    searchPanelOpen,
    keymap.of([
      { key: 'Mod-f', run: openToolbarSearch },
      { key: 'Mod-h', run: openToolbarSearch },
      { key: 'Escape', run: closeToolbarSearch },
    ]),
  ];
}

export function toolbarSearchTheme() {
  return EditorView.theme({
    // Hide CodeMirror's native search UI but keep match highlighting
    '& .cm-search': { display: 'none !important' },
    '& .cm-panels.cm-panels-bottom': { display: 'none !important' },
    '& .cm-searchMatch': {
      backgroundColor: 'var(--vault-search-match-bg))',
      borderRadius: '2px',
      boxShadow: 'inset 0 -1px 0 rgba(146, 64, 14, 0.2)',
    },
    '& .cm-searchMatch-selected': {
      backgroundColor: 'var(--vault-search-match-selected))',
      borderRadius: '2px',
      outline: '1px solid var(--vault-search-match-selected-ring))',
      boxShadow: '0 0 0 1px var(--vault-search-match-selected-ring))',
    },
    // Toolbar search panel styling - matches aA button/popup theme
    '& .cm-toolbar-search-panel': {
      backgroundColor: 'var(--ai-toolbar-bg)',
      borderBottom: '1px solid var(--ai-toolbar-border)',
      padding: '8px 12px',
    },
    '& .cm-toolbar-search-panel .search-container': {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    '& .cm-toolbar-search-panel .search-row, & .cm-toolbar-search-panel .replace-row': {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    '& .cm-toolbar-search-panel .search-input, & .cm-toolbar-search-panel .replace-input': {
      flex: '1',
      padding: '6px 10px',
      fontSize: '14px',
      border: '1px solid var(--ai-toolbar-input-border)',
      borderRadius: '6px',
      backgroundColor: 'var(--ai-toolbar-input-bg)',
      color: 'var(--ai-toolbar-text)',
      outline: 'none',
    },
    '& .cm-toolbar-search-panel .search-input:focus, & .cm-toolbar-search-panel .replace-input:focus': {
      borderColor: 'var(--ai-toolbar-accent-primary)',
      boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.1)',
    },
    '& .cm-toolbar-search-panel .search-btn': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 10px',
      fontSize: '13px',
      fontWeight: '500',
      border: '1px solid var(--ai-toolbar-input-border)',
      borderRadius: '6px',
      backgroundColor: 'transparent',
      color: 'var(--ai-toolbar-text-secondary)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
    '& .cm-toolbar-search-panel .search-btn:hover': {
      backgroundColor: 'var(--ai-toolbar-hover-bg))',
      borderColor: 'var(--ai-toolbar-accent-primary)',
      color: 'var(--ai-toolbar-accent-primary)',
    },
    '& .cm-toolbar-search-panel .search-btn.close': {
      fontWeight: '600',
    },
    '& .cm-toolbar-search-panel .search-option': {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 8px',
      fontSize: '12px',
      fontWeight: '500',
      color: 'var(--ai-toolbar-text-secondary)',
      border: '1px solid var(--ai-toolbar-input-border)',
      borderRadius: '4px',
      cursor: 'pointer',
      userSelect: 'none',
    },
    '& .cm-toolbar-search-panel .search-option:hover': {
      backgroundColor: 'var(--ai-toolbar-hover-bg))',
      borderColor: 'var(--ai-toolbar-accent-primary)',
    },
    '& .cm-toolbar-search-panel .search-option input[type="checkbox"]': {
      accentColor: 'var(--ai-toolbar-accent-primary)',
    },
    '& .cm-toolbar-search-panel .search-match-count': {
      fontSize: '12px',
      fontWeight: '500',
      color: 'var(--ai-toolbar-text-muted)',
      padding: '0 6px',
    },
  });
}

export default toolbarSearch;

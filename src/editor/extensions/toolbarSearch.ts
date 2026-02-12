/**
 * @fileoverview Simple search and replace for CodeMirror toolbar.
 * @module editor/extensions/toolbarSearch
 */

import { EditorView, keymap, ViewPlugin } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import {
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
  controls.searchInput.value = query.search || '';
  controls.replaceInput.value = query.replace || '';
  controls.caseCb.checked = query.caseSensitive;
  controls.wordCb.checked = query.wholeWord;
  controls.regexpCb.checked = query.regexp;
}

// Create search panel DOM
function createSearchPanel(view: EditorView): SearchPanelControls {
  const dom = document.createElement('div');
  dom.className = 'cm-toolbar-search-panel';

  const container = document.createElement('div');
  container.className = 'search-container';
  dom.appendChild(container);

  const searchRow = document.createElement('div');
  searchRow.className = 'search-row';
  container.appendChild(searchRow);

  const replaceRow = document.createElement('div');
  replaceRow.className = 'replace-row';
  container.appendChild(replaceRow);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Find...';
  searchRow.appendChild(searchInput);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'search-btn prev';
  prevBtn.textContent = '^';
  prevBtn.title = 'Previous match (Shift+Enter)';
  prevBtn.setAttribute('aria-label', 'Previous match');
  searchRow.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'search-btn next';
  nextBtn.textContent = 'v';
  nextBtn.title = 'Next match (Enter)';
  nextBtn.setAttribute('aria-label', 'Next match');
  searchRow.appendChild(nextBtn);

  const countEl = document.createElement('span');
  countEl.className = 'search-match-count';
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

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = cssClass;
    input.setAttribute('aria-label', ariaLabel);
    input.title = tooltip;

    const span = document.createElement('span');
    span.textContent = text;

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
  closeBtn.textContent = 'x';
  closeBtn.title = 'Close search (Escape)';
  closeBtn.setAttribute('aria-label', 'Close search');
  searchRow.appendChild(closeBtn);

  const replaceInput = document.createElement('input');
  replaceInput.type = 'text';
  replaceInput.className = 'replace-input';
  replaceInput.placeholder = 'Replace...';
  replaceRow.appendChild(replaceInput);

  const replaceBtn = document.createElement('button');
  replaceBtn.type = 'button';
  replaceBtn.className = 'search-btn replace';
  replaceBtn.textContent = 'Replace';
  replaceBtn.title = 'Replace current match';
  replaceBtn.setAttribute('aria-label', 'Replace current match');
  replaceRow.appendChild(replaceBtn);

  const replaceAllBtn = document.createElement('button');
  replaceAllBtn.type = 'button';
  replaceAllBtn.className = 'search-btn replace-all';
  replaceAllBtn.textContent = 'Replace All';
  replaceAllBtn.title = 'Replace all matches';
  replaceAllBtn.setAttribute('aria-label', 'Replace all matches');
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
    refreshCount();
  });
  nextBtn.addEventListener('click', () => {
    findNext(view);
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

// View plugin to manage search panel
const searchPlugin = ViewPlugin.fromClass(
  class {
    panel: HTMLElement | null = null;
    controls: SearchPanelControls | null = null;
    parent: HTMLElement | null = null;

    constructor(view: EditorView) {
      this.parent = view.dom.parentElement;
      if (view.state.field(searchPanelOpen)) {
        this.openPanel(view);
      }
    }
    
    update(update: ViewUpdate) {
      const wasOpen = update.startState.field(searchPanelOpen);
      const isOpen = update.state.field(searchPanelOpen);
      
      if (isOpen && !wasOpen) {
        this.openPanel(update.view);
      } else if (!isOpen && wasOpen) {
        this.closePanel();
      } else if (isOpen && this.controls) {
        const prevQuery = getSearchQuery(update.startState);
        const currentQuery = getSearchQuery(update.state);
        const queryChanged = !queryEquals(prevQuery, currentQuery);

        if (queryChanged) {
          applyQueryToControls(currentQuery, this.controls);
        }

        if (queryChanged || update.docChanged || update.selectionSet) {
          this.controls.refreshCount();
        }
      }
    }

    openPanel(view: EditorView) {
      if (this.panel) return;
      this.controls = createSearchPanel(view);
      this.panel = this.controls.dom;
      if (this.parent?.firstChild) {
        this.parent.insertBefore(this.panel, this.parent.firstChild);
      }
    }

    closePanel() {
      this.panel?.remove();
      this.panel = null;
      this.controls = null;
    }

    destroy() {
      this.closePanel();
    }
  }
);

export function toolbarSearch() {
  return [
    searchPanelOpen,
    searchPlugin,
    keymap.of([
      { key: 'Mod-f', run: openToolbarSearch },
      { key: 'Mod-h', run: openToolbarSearch },
      { key: 'Escape', run: closeToolbarSearch },
    ]),
  ];
}

export function toolbarSearchTheme() {
  return EditorView.theme({
    '& .cm-search': { display: 'none !important' },
    '& .cm-searchMatch': {
      backgroundColor: 'var(--vault-search-match-bg, rgba(253, 224, 71, 0.4))',
      borderRadius: '2px',
      boxShadow: 'inset 0 -1px 0 rgba(146, 64, 14, 0.2)',
    },
    '& .cm-searchMatch-selected': {
      backgroundColor: 'var(--vault-search-match-selected, rgba(253, 224, 71, 0.8))',
      borderRadius: '2px',
      outline: '1px solid var(--vault-search-match-selected-ring, rgba(180, 83, 9, 0.65))',
      boxShadow: '0 0 0 1px var(--vault-search-match-selected-ring, rgba(180, 83, 9, 0.65))',
    },
  });
}

export default toolbarSearch;

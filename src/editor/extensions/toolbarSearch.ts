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

// Count matches in entire document
function countMatches(view: EditorView, query: SearchQuery): number {
  if (!query.search) return 0;
  
  const text = view.state.doc.toString();
  let count = 0;
  
  try {
    const escaped = query.regexp ? query.search : query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = query.caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escaped, flags);
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      count++;
      if (match[0].length === 0) regex.lastIndex++;
    }
  } catch {
    return 0;
  }
  
  return count;
}

// Get current match index (1-based)
function getCurrentMatchIndex(view: EditorView, query: SearchQuery): number {
  if (!query.search) return 0;
  
  const selection = view.state.selection.main;
  const text = view.state.doc.toString();
  const cursorPos = selection.from;
  
  try {
    const escaped = query.regexp ? query.search : query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = query.caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escaped, flags);
    
    let count = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      count++;
      if (match.index <= cursorPos && cursorPos < match.index + match[0].length) {
        return count;
      }
      if (match[0].length === 0) regex.lastIndex++;
    }
  } catch {
    return 0;
  }
  
  return 0;
}

// Create search panel DOM
function createSearchPanel(view: EditorView): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-toolbar-search-panel';
  
  const query = getSearchQuery(view.state);
  
  dom.innerHTML = `
    <div class="search-container">
      <div class="search-row">
        <input type="text" class="search-input" placeholder="Find..." value="${query.search || ''}" />
        <button class="search-btn prev" title="Previous">↑</button>
        <button class="search-btn next" title="Next">↓</button>
        <span class="search-match-count"></span>
        <label class="search-option"><input type="checkbox" class="case-sensitive" ${query.caseSensitive ? 'checked' : ''} /><span>Aa</span></label>
        <label class="search-option"><input type="checkbox" class="whole-word" ${query.wholeWord ? 'checked' : ''} /><span>ab</span></label>
        <label class="search-option"><input type="checkbox" class="regexp" ${query.regexp ? 'checked' : ''} /><span>.*</span></label>
        <button class="search-btn close">×</button>
      </div>
      <div class="replace-row">
        <input type="text" class="replace-input" placeholder="Replace..." value="${query.replace || ''}" />
        <button class="search-btn replace">Replace</button>
        <button class="search-btn replace-all">Replace All</button>
      </div>
    </div>
  `;
  
  const searchInput = dom.querySelector('.search-input') as HTMLInputElement;
  const replaceInput = dom.querySelector('.replace-input') as HTMLInputElement;
  const caseCb = dom.querySelector('.case-sensitive') as HTMLInputElement;
  const wordCb = dom.querySelector('.whole-word') as HTMLInputElement;
  const regexpCb = dom.querySelector('.regexp') as HTMLInputElement;
  const prevBtn = dom.querySelector('.prev') as HTMLButtonElement;
  const nextBtn = dom.querySelector('.next') as HTMLButtonElement;
  const replaceBtn = dom.querySelector('.replace') as HTMLButtonElement;
  const replaceAllBtn = dom.querySelector('.replace-all') as HTMLButtonElement;
  const closeBtn = dom.querySelector('.close') as HTMLButtonElement;
  const countEl = dom.querySelector('.search-match-count') as HTMLSpanElement;
  
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
    updateCount();
  };
  
  const updateCount = () => {
    const q = getSearchQuery(view.state);
    const total = countMatches(view, q);
    const current = total > 0 ? getCurrentMatchIndex(view, q) : 0;
    
    if (q.search) {
      countEl.textContent = total > 0 ? `${current || 0}/${total}` : '0/0';
      countEl.style.display = 'inline';
    } else {
      countEl.style.display = 'none';
    }
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
      setTimeout(updateCount, 10);
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
  
  prevBtn.addEventListener('click', () => { findPrevious(view); setTimeout(updateCount, 10); });
  nextBtn.addEventListener('click', () => { findNext(view); setTimeout(updateCount, 10); });
  closeBtn.addEventListener('click', () => { closeToolbarSearch(view); view.focus(); });
  
  // Replace current match and move to next
  replaceBtn.addEventListener('click', () => {
    replaceNext(view);
    setTimeout(() => {
      findNext(view);
      updateCount();
    }, 10);
  });
  
  // Replace all matches
  replaceAllBtn.addEventListener('click', () => {
    replaceAll(view);
    // Clear search to prevent re-replacing
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) });
    searchInput.value = '';
    updateCount();
  });
  
  updateCount();
  return dom;
}

// View plugin to manage search panel
const searchPlugin = ViewPlugin.fromClass(
  class {
    panel: HTMLElement | null = null;
    parent: HTMLElement | null = null;
    searchInput: HTMLInputElement | null = null;
    
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
      } else if (isOpen && this.panel) {
        // Panel is already open - check if search query changed
        const prevQuery = getSearchQuery(update.startState);
        const currentQuery = getSearchQuery(update.state);
        
        if (prevQuery.search !== currentQuery.search && this.searchInput) {
          this.searchInput.value = currentQuery.search || '';
          // Update match count display
          const countEl = this.panel.querySelector('.search-match-count') as HTMLSpanElement;
          if (countEl) {
            const total = countMatches(update.view, currentQuery);
            const current = total > 0 ? getCurrentMatchIndex(update.view, currentQuery) : 0;
            if (currentQuery.search) {
              countEl.textContent = total > 0 ? `${current || 0}/${total}` : '0/0';
              countEl.style.display = 'inline';
            } else {
              countEl.style.display = 'none';
            }
          }
        }
      }
    }
    
    openPanel(view: EditorView) {
      if (this.panel) return;
      this.panel = createSearchPanel(view);
      this.searchInput = this.panel.querySelector('.search-input') as HTMLInputElement;
      if (this.parent?.firstChild) {
        this.parent.insertBefore(this.panel, this.parent.firstChild);
      }
    }
    
    closePanel() {
      this.panel?.remove();
      this.panel = null;
      this.searchInput = null;
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
    },
    '& .cm-searchMatch-selected': {
      backgroundColor: 'var(--vault-search-match-selected, rgba(253, 224, 71, 0.8))',
      borderRadius: '2px',
    },
  });
}

export default toolbarSearch;

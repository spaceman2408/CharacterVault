import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

export interface ComposerMention {
  label: string;
  detail?: string;
}

export interface MentionQuery {
  start: number;
  query: string;
}

const MAX_MENTION_RESULTS = 8;

/** The `@query` right before the caret, when the `@` starts a word. */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}

export function filterMentions(options: ComposerMention[], query: string): ComposerMention[] {
  const needle = query.toLowerCase();
  const prefix: ComposerMention[] = [];
  const inner: ComposerMention[] = [];
  for (const option of options) {
    const label = option.label.toLowerCase();
    if (label.replace(/^[“"]/, '').startsWith(needle)) prefix.push(option);
    else if (label.includes(needle)) inner.push(option);
  }
  return [...prefix, ...inner].slice(0, MAX_MENTION_RESULTS);
}

export function insertMention(
  text: string,
  query: MentionQuery,
  caret: number,
  label: string,
): { text: string; caret: number } {
  const mention = `@${label}`;
  const rest = text.slice(caret);
  return {
    text: text.slice(0, query.start) + mention + (/^\s/.test(rest) ? '' : ' ') + rest,
    caret: query.start + mention.length + 1,
  };
}

export function useComposerMentions(
  text: string,
  setText: (text: string) => void,
  inputRef: RefObject<HTMLTextAreaElement | null>,
  getOptions: (() => ComposerMention[]) | undefined,
) {
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const clampedCaret = Math.min(caret, text.length);
  const query = getOptions ? findMentionQuery(text, clampedCaret) : null;
  const matches =
    getOptions && query && query.start !== dismissedStart
      ? filterMentions(getOptions(), query.query)
      : [];
  const active = Math.min(activeIndex, Math.max(0, matches.length - 1));

  useLayoutEffect(() => {
    const next = pendingCaretRef.current;
    const input = inputRef.current;
    if (next == null || !input) return;
    pendingCaretRef.current = null;
    input.focus();
    input.setSelectionRange(next, next);
  }, [text, inputRef]);

  const trackCaret = (input: HTMLTextAreaElement) => {
    setCaret(input.selectionStart);
    // A fresh `@` reopens the list after Escape.
    const current = findMentionQuery(input.value, input.selectionStart);
    if (!current || current.query === '') setDismissedStart(null);
  };

  const onInputChange = (input: HTMLTextAreaElement) => {
    trackCaret(input);
    setActiveIndex(0);
  };

  const pick = (option: ComposerMention) => {
    if (!query) return;
    const next = insertMention(text, query, clampedCaret, option.label);
    pendingCaretRef.current = next.caret;
    setText(next.text);
    setCaret(next.caret);
    setActiveIndex(0);
  };

  /** True when the open list handled the key. */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!query || matches.length === 0) return false;
    if (e.key === 'ArrowDown') setActiveIndex((active + 1) % matches.length);
    else if (e.key === 'ArrowUp') setActiveIndex((active - 1 + matches.length) % matches.length);
    else if (e.key === 'Enter' || e.key === 'Tab') pick(matches[active]);
    else if (e.key === 'Escape') setDismissedStart(query.start);
    else return false;
    e.preventDefault();
    return true;
  };

  return { matches, activeIndex: active, setActiveIndex, pick, trackCaret, onInputChange, handleKeyDown };
}

import { parse as parseCss, stringify as stringifyCss } from '@adobe/css-tools';
import createDOMPurify, { type Config, type DOMPurify } from 'dompurify';
import showdown from 'showdown';

const SILLYTAVERN_NOTES_ID = 'creator_notes_spoiler';

export interface SillyTavernRenderOptions {
  charName: string;
  userName?: string;
  allowExternalMedia?: boolean;
}

export interface SillyTavernRenderResult {
  /** Wrapped in `<div id="creator_notes_spoiler">`, the element ST scopes styles to. */
  bodyContent: string;
  notices: string[];
}

const SCOPE_PREFIX = `#${SILLYTAVERN_NOTES_ID} `;
const PAGE_SELECTOR = /(?:^|[\s>+~,(])(?::root|html|body)(?![\w-])/i;

let converter: showdown.Converter | null = null;
let purifier: DOMPurify | null = null;

interface RenderTally {
  removedMedia: number;
  removedCssUrls: number;
  removedImports: number;
  pageSelectors: boolean;
  cssError: boolean;
  commentInRule: boolean;
}

let tally: RenderTally | null = null;
let externalMediaAllowed = false;

function underscoreItalicsExtension(): showdown.ShowdownExtension[] {
  return [{
    type: 'output',
    regex: /(<code(?:\s+[^>]*)?>[\s\S]*?<\/code>|<style(?:\s+[^>]*)?>[\s\S]*?<\/style>)|\b(?<!_)_(?!_)(.*?)(?<!_)_(?!_)\b/gi,
    replace: (match: string, tagContent?: string, italicContent?: string) => {
      if (tagContent) return match;
      if (italicContent) return `<em>${italicContent}</em>`;
      return match;
    },
  }];
}

function getConverter(): showdown.Converter {
  converter ??= new showdown.Converter({
    emoji: true,
    literalMidWordUnderscores: true,
    parseImgDimensions: true,
    tables: true,
    underline: true,
    simpleLineBreaks: true,
    strikethrough: true,
    disableForced4SpacesIndentedSublists: true,
    extensions: [underscoreItalicsExtension()],
  });
  return converter;
}

function isExternalUrl(url: string): boolean {
  return (url.indexOf('://') > 0 || url.indexOf('//') === 0) && !url.startsWith(window.location.origin);
}

function getPurifier(): DOMPurify {
  if (purifier) return purifier;
  const instance = createDOMPurify(window);

  instance.addHook('afterSanitizeAttributes', (node) => {
    if ('target' in node) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener');
    }
  });

  instance.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'class' || !data.attrValue) return;
    data.attrValue = data.attrValue
      .split(' ')
      .map((v) => (v.startsWith('fa-') || v.startsWith('note-') || v === 'monospace' ? v : `custom-${v}`))
      .join(' ');
  });

  instance.addHook('uponSanitizeElement', (node) => {
    if (node instanceof HTMLUnknownElement) {
      node.innerHTML = node.innerHTML.trim();
      const candidates: Text[] = [];
      const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        if (!textNode.data.includes('\n')) continue;
        if (textNode.parentElement?.closest('pre')) continue;
        candidates.push(textNode);
      }
      for (const textNode of candidates) {
        const parts = textNode.data.split('\n');
        const frag = node.ownerDocument.createDocumentFragment();
        parts.forEach((part, idx) => {
          if (part.length) frag.appendChild(node.ownerDocument.createTextNode(part));
          if (idx < parts.length - 1) frag.appendChild(node.ownerDocument.createElement('br'));
        });
        textNode.replaceWith(frag);
      }
    }

    if (externalMediaAllowed || !(node instanceof Element)) return;

    switch (node.tagName) {
      case 'AUDIO':
      case 'VIDEO':
      case 'SOURCE':
      case 'TRACK':
      case 'EMBED':
      case 'OBJECT':
      case 'IMG': {
        const src = node.getAttribute('src');
        const data = node.getAttribute('data');
        const srcset = node.getAttribute('srcset');
        let blocked = false;
        if (srcset) {
          blocked = srcset.split(',').some((entry) => isExternalUrl(entry.trim().split(' ')[0]));
        }
        if (!blocked && src && isExternalUrl(src)) blocked = true;
        if (!blocked && data && isExternalUrl(data)) blocked = true;
        if (blocked) {
          node.remove();
          if (tally) tally.removedMedia++;
        }
        break;
      }
    }
  });

  purifier = instance;
  return instance;
}

function substituteMacros(text: string, charName: string, userName: string): string {
  return text
    .replace(/<USER>/gi, () => userName)
    .replace(/<BOT>/gi, () => charName)
    .replace(/<CHAR>/gi, () => charName)
    .replace(/{{user}}/gi, () => userName)
    .replace(/{{char}}/gi, () => charName);
}

function encodeStyleTags(text: string): string {
  return text.replaceAll(/<style>(.+?)<\/style>/gims, (_, match: string) =>
    `<custom-style>${encodeURIComponent(match)}</custom-style>`,
  );
}

type CssNode = {
  type?: string;
  selectors?: string[];
  declarations?: Array<{ type?: string; value?: string }>;
  rules?: CssNode[];
};

function sanitizeSimpleSelector(selector: string): string {
  return selector
    .split(/\s+/)
    .map((part) => part.replace(/\.([\w-]+)/g, (match, className: string) =>
      className.startsWith('custom-') ? match : `.custom-${className}`,
    ))
    .join(' ');
}

function sanitizeSelector(selector: string): string {
  const pseudoRegex = /:(has|not|where|is|matches|any)\(([^)]+)\)/g;
  const nested = selector.replace(pseudoRegex, (_match, pseudoClass: string, content: string) =>
    `:${pseudoClass}(${sanitizeSimpleSelector(content)})`,
  );
  return sanitizeSimpleSelector(nested);
}

function sanitizeRule(rule: CssNode): void {
  if (Array.isArray(rule.selectors)) {
    for (let i = 0; i < rule.selectors.length; i++) {
      const selector = rule.selectors[i];
      if (!selector) continue;
      if (tally && PAGE_SELECTOR.test(selector)) tally.pageSelectors = true;
      rule.selectors[i] = SCOPE_PREFIX + sanitizeSelector(selector);
    }
  }
  if (!externalMediaAllowed && Array.isArray(rule.declarations) && rule.declarations.length > 0) {
    const before = rule.declarations.length;
    if (tally && rule.declarations.some((d) => d.value === undefined)) tally.commentInRule = true;
    // ST calls value.includes on every node, so a comment inside a rule throws and the
    // whole block renders as "CSS ERROR". Reproduced on purpose.
    rule.declarations = rule.declarations.filter((d) => !(d.value as string).includes('://'));
    if (tally) tally.removedCssUrls += before - rule.declarations.length;
  }
}

function sanitizeRuleSet(ruleSet: CssNode): void {
  if (Array.isArray(ruleSet.selectors) || Array.isArray(ruleSet.declarations)) {
    sanitizeRule(ruleSet);
  }
  if (Array.isArray(ruleSet.rules)) {
    const before = ruleSet.rules.length;
    ruleSet.rules = ruleSet.rules.filter((rule) => rule.type !== 'import');
    if (tally) tally.removedImports += before - ruleSet.rules.length;
    for (const child of ruleSet.rules) sanitizeRuleSet(child);
  }
}

function decodeStyleTags(text: string): string {
  return text.replaceAll(/<custom-style>(.+?)<\/custom-style>/gms, (_, style: string) => {
    try {
      const cleaned = decodeURIComponent(style).replaceAll(/<br\/>/g, '');
      const ast = parseCss(cleaned);
      if (ast?.stylesheet) sanitizeRuleSet(ast.stylesheet as unknown as CssNode);
      return `<style>${stringifyCss(ast)}</style>`;
    } catch (error) {
      if (tally) tally.cssError = true;
      return `CSS ERROR: ${String(error)}`;
    }
  });
}

function describeRemoved(removed: DOMPurify['removed']): string | null {
  const names = new Set<string>();
  for (const item of removed) {
    if ('attribute' in item && item.attribute) {
      names.add(item.attribute.name);
    } else if ('element' in item && item.element instanceof Element) {
      names.add(`<${item.element.tagName.toLowerCase()}>`);
    }
  }
  return names.size > 0 ? `Removed: ${[...names].join(', ')}` : null;
}

const BLANK_EDGE_TAGS = new Set(['BR', 'TITLE', 'META', 'LINK']);

function isBlankEdge(el: Element): boolean {
  if (el.tagName === 'BR') return true;
  if (el.tagName !== 'P') return false;
  return [...el.childNodes].every((node) =>
    node instanceof Element ? BLANK_EDGE_TAGS.has(node.tagName) : !node.textContent?.trim(),
  );
}

/**
 * ST turns each line of a full-page wrapper (`<!DOCTYPE>`, `<html>`, `<head>`, `<body>`)
 * into a `<br>`, leaving blank lines above and below the notes. The preview hides them on
 * purpose (the user's call), even though ST shows them.
 */
function trimBlankEdges(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const blocks = () => [...template.content.children].filter((el) => el.tagName !== 'STYLE');
  for (const el of blocks()) {
    if (!isBlankEdge(el)) break;
    el.remove();
  }
  for (const el of blocks().reverse()) {
    if (!isBlankEdge(el)) break;
    el.remove();
  }
  return template.innerHTML;
}

/**
 * Mirrors SillyTavern's `formatCreatorNotes` (public/scripts/chats.js): macros, showdown,
 * DOMPurify with ST's hooks, then `<style>` selectors scoped to `#creator_notes_spoiler`
 * with classes renamed to `custom-*`. Keep its quirks; matching ST is the point.
 */
export function renderCreatorNotesLikeSillyTavern(
  text: string,
  { charName, userName = 'User', allowExternalMedia = false }: SillyTavernRenderOptions,
): SillyTavernRenderResult {
  if (!text) return { bodyContent: '', notices: [] };

  const purify = getPurifier();
  const config: Config = {
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    ADD_TAGS: ['custom-style'],
  };

  tally = { removedMedia: 0, removedCssUrls: 0, removedImports: 0, pageSelectors: false, cssError: false, commentInRule: false };
  externalMediaAllowed = allowExternalMedia;
  try {
    let html = getConverter().makeHtml(substituteMacros(text, charName, userName));
    html = encodeStyleTags(html);
    html = purify.sanitize(html, config) as string;
    const removed = describeRemoved(purify.removed);
    html = trimBlankEdges(decodeStyleTags(html));

    const notices: string[] = [];
    if (tally.pageSelectors) notices.push(':root, html, and body styles won’t apply');
    if (tally.removedImports > 0) notices.push('@import removed');
    if (tally.removedMedia > 0) notices.push('Remote images and media hidden');
    if (tally.removedCssUrls > 0) notices.push('Styles with remote URLs removed');
    if (tally.commentInRule) notices.push('Comments inside CSS rules break the style block');
    else if (tally.cssError) notices.push('CSS error: a style block shows as text');
    if (removed) notices.push(removed);
    return { bodyContent: `<div id="${SILLYTAVERN_NOTES_ID}">${html}</div>`, notices };
  } finally {
    tally = null;
    externalMediaAllowed = false;
  }
}

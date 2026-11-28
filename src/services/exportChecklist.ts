import { CHARACTER_SECTIONS, type CharacterBook, type CharacterSpec } from '../db/characterTypes';
import { entryDisplayLabel } from './findReplace';

export type ExportCheckTarget =
  | { type: 'field'; id: string }
  | { type: 'greeting'; index: number }
  | { type: 'entry'; id: number };

export interface ExportCheckFinding {
  id: string;
  message: string;
  target: ExportCheckTarget;
}

const SCANNED_FIELDS = [
  'name',
  'description',
  'personality',
  'physical_description',
  'scenario',
  'first_mes',
  'mes_example',
  'system_prompt',
  'post_history_instructions',
] as const;

const AI_JUNK =
  /<\/?(?:think|thinking|reasoning|arg_key|arg_value|tool_call|tool_use|function_calls?|invoke|parameter)\b[^>]*>|<\|[a-z0-9_]+\|>/i;

const MACRO_LIKE = /\{+\s*(?:char|user)\s*\}+/gi;

const NAMED_MACRO = /\{\{\s*([a-z_]+)\s*\}\}/gi;

const CORE_MACROS = ['char', 'user'];

function fieldLabel(id: string): string {
  return CHARACTER_SECTIONS.find((section) => section.id === id)?.label ?? id;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

// Other SillyTavern macros ({{time}}, {{random}}, …) are valid, so only names a typo or two
// away from char/user are treated as misspellings.
function isMisspelledCoreMacro(name: string): boolean {
  const lower = name.toLowerCase();
  if (CORE_MACROS.includes(lower)) return false;
  return CORE_MACROS.some((macro) => editDistance(lower, macro) <= 2);
}

function findBrokenMacro(text: string): string | null {
  for (const match of text.matchAll(MACRO_LIKE)) {
    const open = match[0].match(/^\{+/)?.[0].length ?? 0;
    const close = match[0].match(/\}+$/)?.[0].length ?? 0;
    if (open !== 2 || close !== 2) return match[0];
  }
  for (const match of text.matchAll(NAMED_MACRO)) {
    if (isMisspelledCoreMacro(match[1])) return match[0];
  }
  return null;
}

function findJunk(text: string): string | null {
  return text.match(AI_JUNK)?.[0] ?? null;
}

interface ScannedText {
  key: string;
  label: string;
  text: string;
  target: ExportCheckTarget;
}

function scannedTexts(spec: CharacterSpec, book: CharacterBook | undefined): ScannedText[] {
  const texts: ScannedText[] = SCANNED_FIELDS.map((id) => ({
    key: `field:${id}`,
    label: fieldLabel(id),
    text: spec[id] ?? '',
    target: { type: 'field', id },
  }));
  (spec.alternate_greetings ?? []).forEach((text, index) => {
    texts.push({
      key: `greeting:${index}`,
      label: `Greeting ${index + 1}`,
      text: text ?? '',
      target: { type: 'greeting', index: index + 1 },
    });
  });
  for (const entry of book?.entries ?? []) {
    texts.push({
      key: `entry:${entry.id}`,
      label: `lorebook entry “${entryDisplayLabel(entry)}”`,
      text: entry.content ?? '',
      target: { type: 'entry', id: entry.id },
    });
  }
  return texts;
}

export function checkCardForExport(
  spec: CharacterSpec,
  book: CharacterBook | undefined,
): ExportCheckFinding[] {
  const findings: ExportCheckFinding[] = [];

  if (!(spec.name ?? '').trim()) {
    findings.push({ id: 'empty:name', message: 'Name is empty', target: { type: 'field', id: 'name' } });
  }
  if (!(spec.first_mes ?? '').trim()) {
    findings.push({
      id: 'empty:first_mes',
      message: 'First message is empty',
      target: { type: 'field', id: 'first_mes' },
    });
  }

  const greetings = spec.alternate_greetings ?? [];
  const blankGreeting = greetings.findIndex((greeting) => !(greeting ?? '').trim());
  if (blankGreeting !== -1) {
    const count = greetings.filter((greeting) => !(greeting ?? '').trim()).length;
    findings.push({
      id: 'blank:greetings',
      message: count === 1 ? '1 alternate greeting is blank' : `${count} alternate greetings are blank`,
      target: { type: 'greeting', index: blankGreeting + 1 },
    });
  }

  for (const item of scannedTexts(spec, book)) {
    const macro = findBrokenMacro(item.text);
    if (macro) {
      findings.push({
        id: `macro:${item.key}`,
        message: `Broken macro ${macro} in ${item.label}`,
        target: item.target,
      });
    }
    const junk = findJunk(item.text);
    if (junk) {
      findings.push({
        id: `junk:${item.key}`,
        message: `Leftover AI text ${junk} in ${item.label}`,
        target: item.target,
      });
    }
  }

  const examples = (spec.mes_example ?? '').trim();
  if (examples && !/<START>/i.test(examples)) {
    findings.push({
      id: 'examples:start',
      message: 'Examples have no <START> line',
      target: { type: 'field', id: 'mes_example' },
    });
  }

  const keyless = (book?.entries ?? []).filter(
    (entry) =>
      entry.enabled !== false &&
      !entry.constant &&
      entry.extensions?.vectorized !== true &&
      !(entry.keys ?? []).some((key) => key.trim()),
  );
  if (keyless.length > 0) {
    findings.push({
      id: 'lorebook:keyless',
      message:
        keyless.length === 1
          ? `Lorebook entry “${entryDisplayLabel(keyless[0])}” has no keys and never fires`
          : `${keyless.length} lorebook entries have no keys and never fire`,
      target: { type: 'entry', id: keyless[0].id },
    });
  }

  return findings;
}

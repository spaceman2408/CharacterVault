import { describe, expect, it } from 'vitest';
import type { CharacterBook, CharacterSpec, LorebookEntry } from '../../src/db/characterTypes';
import { checkCardForExport } from '../../src/services/exportChecklist';

function spec(overrides: Partial<CharacterSpec> = {}): CharacterSpec {
  return {
    name: 'Mira',
    description: '{{char}} runs a tea shop. {{user}} is a regular.',
    personality: '',
    scenario: '',
    first_mes: '*Mira looks up.* "Welcome back, {{user}}."',
    mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello.',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: ['Another day.'],
    physical_description: '',
    ...overrides,
  };
}

function entry(overrides: Partial<LorebookEntry> = {}): LorebookEntry {
  return { id: 1, keys: ['tea'], content: 'Tea lore.', extensions: {}, enabled: true, ...overrides };
}

function book(entries: LorebookEntry[]): CharacterBook {
  return { extensions: {}, entries };
}

const ids = (findings: ReturnType<typeof checkCardForExport>) => findings.map((f) => f.id);

describe('checkCardForExport', () => {
  it('finds nothing on a clean card', () => {
    expect(checkCardForExport(spec(), book([entry()]))).toEqual([]);
  });

  it('flags an empty name and first message', () => {
    const findings = checkCardForExport(spec({ name: ' ', first_mes: '' }), undefined);
    expect(ids(findings)).toEqual(['empty:name', 'empty:first_mes']);
    expect(findings[1].target).toEqual({ type: 'field', id: 'first_mes' });
  });

  it('counts blank greetings and targets the first one', () => {
    const findings = checkCardForExport(spec({ alternate_greetings: ['Hi', '', '  '] }), undefined);
    expect(findings).toEqual([
      { id: 'blank:greetings', message: '2 alternate greetings are blank', target: { type: 'greeting', index: 2 } },
    ]);
  });

  it('flags single, unbalanced, and tripled macro braces but not case or valid macros', () => {
    const findings = checkCardForExport(
      spec({
        description: 'Hi {user} and {{Char}}.',
        scenario: 'Meet {{char}.',
        personality: '{{{user}}}',
      }),
      undefined,
    );
    expect(findings.map((f) => f.message)).toEqual([
      'Broken macro {user} in Description',
      'Broken macro {{{user}}} in Personality',
      'Broken macro {{char} in Scenario',
    ]);
  });

  it('flags misspelled char and user macros', () => {
    const findings = checkCardForExport(
      spec({
        description: '{{char}} will NEVER speak for {{use}}',
        personality: 'Talks to {{USR}}.',
        scenario: 'Meet {{chr}}.',
      }),
      undefined,
    );
    expect(findings.map((f) => f.message)).toEqual([
      'Broken macro {{use}} in Description',
      'Broken macro {{USR}} in Personality',
      'Broken macro {{chr}} in Scenario',
    ]);
  });

  it('leaves other SillyTavern macros alone', () => {
    const description =
      '{{User}} {{CHAR}} {{time}} {{date}} {{random}} {{roll}} {{bias}} {{trim}} {{noop}} {{input}} {{persona}} {{group}} {{charVersion}} {{getvar::mood}}';
    expect(checkCardForExport(spec({ description }), undefined)).toEqual([]);
  });

  it('flags leftover AI text in the name, greetings, and lorebook entries', () => {
    const findings = checkCardForExport(
      spec({ name: 'Emrys</arg_value>', alternate_greetings: ['<think>plan</think>Hello'] }),
      book([entry({ id: 7, comment: 'Shop', content: 'Text<|im_end|>' })]),
    );
    expect(findings.map((f) => f.message)).toEqual([
      'Leftover AI text </arg_value> in Name',
      'Leftover AI text <think> in Greeting 1',
      'Leftover AI text <|im_end|> in lorebook entry “Shop”',
    ]);
    expect(findings[2].target).toEqual({ type: 'entry', id: 7 });
  });

  it('flags examples without a <START> line only when examples exist', () => {
    expect(ids(checkCardForExport(spec({ mes_example: '{{char}}: Hello.' }), undefined))).toEqual(['examples:start']);
    expect(checkCardForExport(spec({ mes_example: '' }), undefined)).toEqual([]);
  });

  it('flags enabled keyless entries but not constant, disabled, or vectorized ones', () => {
    const findings = checkCardForExport(
      spec(),
      book([
        entry({ id: 1, keys: [] }),
        entry({ id: 2, keys: [' '] }),
        entry({ id: 3, keys: [], constant: true }),
        entry({ id: 4, keys: [], enabled: false }),
        entry({ id: 5, keys: [], extensions: { vectorized: true } }),
      ]),
    );
    expect(findings).toEqual([
      {
        id: 'lorebook:keyless',
        message: '2 lorebook entries have no keys and never fire',
        target: { type: 'entry', id: 1 },
      },
    ]);
  });
});

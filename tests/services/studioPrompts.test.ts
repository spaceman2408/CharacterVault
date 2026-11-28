import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_PROMPTS, normalizeStudioSettings } from '../../src/db/characterTypes';
import { LEGACY_STUDIO_PROMPTS } from '../../src/db/legacyStudioPrompts';
import {
  buildRevisionBlock,
  replaceNameWithCharMacro,
  renderStudioTemplate,
  validateStudioPrompts,
} from '../../src/pages/ai-creation-studio/generationPrompts';

describe('renderStudioTemplate', () => {
  it('replaces all variables and leaves {{user}} untouched', () => {
    const out = renderStudioTemplate('Hi ${name}, concept ${concept} {{user}} ${name}', {
      name: 'Ada',
      concept: 'witty mage',
    });
    expect(out).toBe('Hi Ada, concept witty mage {{user}} Ada');
  });

  it('leaves unprovided vars intact', () => {
    const out = renderStudioTemplate('a${styleBlock}b', {});
    expect(out).toBe('a${styleBlock}b');
  });
});

describe('validateStudioPrompts', () => {
  it('accepts defaults', () => {
    expect(validateStudioPrompts(DEFAULT_STUDIO_PROMPTS)).toBeNull();
  });

  it('rejects empty and missing vars', () => {
    const err = validateStudioPrompts({ ...DEFAULT_STUDIO_PROMPTS, name: 'no vars here' });
    expect(err).toContain('name');
    expect(err).toContain('${concept}');
  });

  it('rejects empty system prompt', () => {
    const err = validateStudioPrompts({ ...DEFAULT_STUDIO_PROMPTS, system: '   ' });
    expect(err).toContain('system');
  });
});

describe('normalizeStudioSettings', () => {
  it('fills missing prompts from defaults and preserves customs', () => {
    const normalized = normalizeStudioSettings({
      enabledFields: { mes_example: false },
      prompts: { name: 'Custom ${concept}' },
    });
    expect(normalized.enabledFields.mes_example).toBe(false);
    expect(normalized.enabledFields.name).toBe(true);
    expect(normalized.prompts.name).toBe('Custom ${concept}');
    expect(normalized.prompts.system).toBe(DEFAULT_STUDIO_PROMPTS.system);
  });

  it('keeps name and description required and allows first_mes and examples off', () => {
    const normalized = normalizeStudioSettings({
      enabledFields: { name: false, description: false, first_mes: false, mes_example: false },
    });
    expect(normalized.enabledFields.name).toBe(true);
    expect(normalized.enabledFields.description).toBe(true);
    expect(normalized.enabledFields.first_mes).toBe(false);
    expect(normalized.enabledFields.mes_example).toBe(false);
  });

  it('falls back to defaults for empty prompt strings', () => {
    const normalized = normalizeStudioSettings({ prompts: { system: '' } });
    expect(normalized.prompts.system).toBe(DEFAULT_STUDIO_PROMPTS.system);
  });

  it('upgrades saved copies of old built-in defaults and keeps edited prompts', () => {
    const legacy = LEGACY_STUDIO_PROMPTS[0];
    const edited = `${legacy.first_mes}
Keep it short.`;
    const normalized = normalizeStudioSettings({
      prompts: { ...legacy, first_mes: edited },
    });
    expect(normalized.prompts.description).toBe(DEFAULT_STUDIO_PROMPTS.description);
    expect(normalized.prompts.mes_example).toBe(DEFAULT_STUDIO_PROMPTS.mes_example);
    expect(normalized.prompts.first_mes).toBe(edited);
  });

  it('keeps old defaults distinct from current ones', () => {
    for (const legacy of LEGACY_STUDIO_PROMPTS) {
      for (const key of Object.keys(DEFAULT_STUDIO_PROMPTS) as Array<keyof typeof DEFAULT_STUDIO_PROMPTS>) {
        expect(legacy[key]).not.toBe(DEFAULT_STUDIO_PROMPTS[key]);
      }
    }
  });
});

describe('buildRevisionBlock', () => {
  it('includes the previous version and the note', () => {
    const block = buildRevisionBlock('  Maren Odell ', '  more Welsh ');
    expect(block).toContain('Previous version:\nMaren Odell\n');
    expect(block).toContain('follows this note: more Welsh\n');
  });

  it('omits the previous version when there is none', () => {
    expect(buildRevisionBlock(undefined, 'older')).not.toContain('Previous version');
  });
});

describe('replaceNameWithCharMacro', () => {
  it('replaces the full name and capitalized name parts as whole words', () => {
    const text = "{{user}}: Isolda Merrick? *Isolda's knife stops. Merrick rhymes with nothing; Isoldane is a town.*";
    expect(replaceNameWithCharMacro(text, 'Isolda Merrick')).toBe(
      "{{user}}: {{char}}? *{{char}}'s knife stops. {{char}} rhymes with nothing; Isoldane is a town.*"
    );
  });

  it('leaves lowercase connecting words alone', () => {
    expect(replaceNameWithCharMacro('Aldric of the Vale went to the vale.', 'Aldric of the Vale')).toBe(
      '{{char}} went to the vale.'
    );
  });

  it('returns text unchanged for an empty name', () => {
    expect(replaceNameWithCharMacro('Hello', '  ')).toBe('Hello');
  });
});

describe('legacy studio prompts', () => {
  it('upgrades a saved copy of every earlier default to the current one', () => {
    for (const legacy of LEGACY_STUDIO_PROMPTS) {
      expect(normalizeStudioSettings({ prompts: legacy }).prompts).toEqual(DEFAULT_STUDIO_PROMPTS);
    }
  });
});

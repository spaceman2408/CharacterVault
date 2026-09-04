import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDIO_PROMPTS, normalizeStudioSettings } from '../../src/db/characterTypes';
import {
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

  it('falls back to defaults for empty prompt strings', () => {
    const normalized = normalizeStudioSettings({ prompts: { system: '' } });
    expect(normalized.prompts.system).toBe(DEFAULT_STUDIO_PROMPTS.system);
  });
});

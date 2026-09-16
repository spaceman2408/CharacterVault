import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type CustomToolbarOp } from '../../src/db/characterTypes';
import {
  BUILTIN_TOOLBAR_BUTTONS,
  CUSTOM_BUTTON_COLOR,
  createCustomOpId,
  isBuiltinOperation,
  moveToolbarOp,
  prunePromptModelsForToolbar,
  resolvePromptTemplate,
  resolveToolbarButtons,
  toolbarButtonLabel,
  validateCustomOp,
  validateToolbarConfig,
} from '../../src/services/toolbarConfig';

const PIRATE: CustomToolbarOp = {
  id: 'custom:pirate',
  label: 'Pirate',
  icon: '🏴',
  prompt: 'Rewrite like a pirate: ${text}',
};

describe('isBuiltinOperation', () => {
  it('recognizes builtins and rejects customs', () => {
    expect(isBuiltinOperation('expand')).toBe(true);
    expect(isBuiltinOperation('instruct')).toBe(true);
    expect(isBuiltinOperation('custom:pirate')).toBe(false);
    expect(isBuiltinOperation('nope')).toBe(false);
  });
});

describe('resolveToolbarButtons', () => {
  it('resolves the default layout with historical labels', () => {
    const defs = resolveToolbarButtons({ order: [...DEFAULT_SETTINGS.toolbar.order], customOps: [] });
    expect(defs.map((d) => d.id)).toEqual([
      'expand', 'rewrite', 'instruct', 'shorten', 'lengthen', 'vivid', 'emotion', 'grammar',
    ]);
    expect(defs[0]).toMatchObject({ label: 'Enhance', icon: '✨', isCustom: false });
    expect(defs[2]).toMatchObject({ label: 'Custom', isCustom: false });
  });

  it('resolves custom ops with default chrome', () => {
    const defs = resolveToolbarButtons({ order: ['instruct', PIRATE.id], customOps: [PIRATE] });
    expect(defs).toHaveLength(2);
    expect(defs[1]).toEqual({
      id: PIRATE.id,
      label: 'Pirate',
      icon: '🏴',
      color: CUSTOM_BUTTON_COLOR,
      isCustom: true,
    });
  });

  it('skips unknown ids', () => {
    const defs = resolveToolbarButtons({
      order: ['instruct', 'custom:ghost', 'expand'],
      customOps: [],
    });
    expect(defs.map((d) => d.id)).toEqual(['instruct', 'expand']);
  });

  it('exposes builtin registry entries for every default order id', () => {
    for (const id of DEFAULT_SETTINGS.toolbar.order) {
      expect(BUILTIN_TOOLBAR_BUTTONS[id as keyof typeof BUILTIN_TOOLBAR_BUTTONS]).toBeDefined();
    }
  });
});

describe('toolbarButtonLabel', () => {
  it('labels builtins, customs, and unknown ids', () => {
    expect(toolbarButtonLabel('expand')).toBe('Enhance');
    expect(toolbarButtonLabel(PIRATE.id, [PIRATE])).toBe('Pirate');
    expect(toolbarButtonLabel('custom:ghost', [PIRATE])).toBe('custom:ghost');
  });
});

describe('resolvePromptTemplate', () => {
  it('resolves builtin templates from prompt settings', () => {
    expect(resolvePromptTemplate('expand', DEFAULT_SETTINGS.prompts, [])).toBe(
      DEFAULT_SETTINGS.prompts.expand,
    );
  });

  it('resolves custom templates from custom ops', () => {
    expect(resolvePromptTemplate(PIRATE.id, DEFAULT_SETTINGS.prompts, [PIRATE])).toBe(PIRATE.prompt);
  });

  it('throws for unknown operations', () => {
    expect(() => resolvePromptTemplate('custom:ghost', DEFAULT_SETTINGS.prompts, [PIRATE])).toThrow(
      'Unknown toolbar operation: custom:ghost',
    );
  });
});

describe('validateCustomOp', () => {
  it('requires a label', () => {
    expect(validateCustomOp({ label: '  ', prompt: 'Do ${text}' })).toBe('Button label is required');
  });

  it('caps label length', () => {
    expect(validateCustomOp({ label: 'x'.repeat(41), prompt: 'Do ${text}' })).toBe(
      'Button label must be 40 characters or less',
    );
  });

  it('rejects duplicate labels case-insensitively', () => {
    expect(validateCustomOp({ label: 'pirate', prompt: 'Do ${text}' }, ['Pirate'])).toBe(
      'A button labeled "pirate" already exists',
    );
  });

  it('requires ${text} in the prompt', () => {
    expect(validateCustomOp({ label: 'Pirate', prompt: 'no placeholder' })).toBe(
      'Custom prompt must contain ${text}',
    );
  });

  it('accepts a valid op', () => {
    expect(validateCustomOp({ label: 'Pirate', prompt: PIRATE.prompt }, ['Enhance'])).toBeNull();
  });
});

describe('validateToolbarConfig', () => {
  it('accepts the default config', () => {
    expect(validateToolbarConfig({ order: [...DEFAULT_SETTINGS.toolbar.order], customOps: [] })).toBeNull();
  });

  it('rejects duplicate custom labels', () => {
    const err = validateToolbarConfig({
      order: ['instruct', 'custom:a', 'custom:b'],
      customOps: [
        { id: 'custom:a', label: 'Pirate', icon: '🏴', prompt: 'Do ${text}' },
        { id: 'custom:b', label: 'pirate', icon: '🔥', prompt: 'Do ${text}' },
      ],
    });
    expect(err).toContain('Duplicate button label');
  });

  it('rejects labels colliding with builtins', () => {
    const err = validateToolbarConfig({
      order: ['instruct', 'custom:a'],
      customOps: [{ id: 'custom:a', label: 'Enhance', icon: '🏴', prompt: 'Do ${text}' }],
    });
    expect(err).toContain('collides with a built-in button label');
  });
});

describe('moveToolbarOp', () => {
  const order = ['expand', 'rewrite', 'instruct'];

  it('moves entries within bounds', () => {
    expect(moveToolbarOp(order, 'expand', 2)).toEqual(['rewrite', 'instruct', 'expand']);
    expect(moveToolbarOp(order, 'instruct', 0)).toEqual(['instruct', 'expand', 'rewrite']);
  });

  it('clamps out-of-range targets', () => {
    expect(moveToolbarOp(order, 'expand', 99)).toEqual(['rewrite', 'instruct', 'expand']);
    expect(moveToolbarOp(order, 'instruct', -5)).toEqual(['instruct', 'expand', 'rewrite']);
  });

  it('returns a copy for unknown ids', () => {
    const next = moveToolbarOp(order, 'nope', 0);
    expect(next).toEqual(order);
    expect(next).not.toBe(order);
  });
});

describe('prunePromptModelsForToolbar', () => {
  it('returns empty for nullish input', () => {
    expect(prunePromptModelsForToolbar(null, { order: ['instruct'], customOps: [] })).toEqual({});
    expect(prunePromptModelsForToolbar(undefined, { order: ['instruct'], customOps: [] })).toEqual({});
  });

  it('keeps builtins and live customs, drops deleted customs', () => {
    const binding = { baseUrl: 'https://x.com/v1', modelId: 'm' };
    const result = prunePromptModelsForToolbar(
      { expand: binding, 'custom:pirate': binding, 'custom:ghost': binding },
      { order: ['instruct', 'custom:pirate'], customOps: [PIRATE] },
    );
    expect(result).toEqual({ expand: binding, 'custom:pirate': binding });
  });
});

describe('createCustomOpId', () => {
  it('creates unique custom-prefixed ids', () => {
    const a = createCustomOpId();
    const b = createCustomOpId();
    expect(a.startsWith('custom:')).toBe(true);
    expect(a).not.toBe(b);
  });
});

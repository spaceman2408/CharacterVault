import { describe, expect, it } from 'vitest';
import {
  addSavedPreset,
  defaultPresetLabel,
  findSavedPreset,
  isPresetUrl,
  removeSavedPreset,
  suggestPresetLabel,
} from '../../../src/components/settings/config/aiBaseUrlPresets';

const MINE = 'https://my.host/v1';
const OPENROUTER = 'https://openrouter.ai/api/v1';
const saved = [{ label: 'Mine', baseUrl: MINE }];

describe('saved base URL presets', () => {
  it('treats saved URLs as presets only when the list is given', () => {
    expect(isPresetUrl('https://nano-gpt.com/api/v1/')).toBe(true);
    expect(isPresetUrl(MINE)).toBe(false);
    expect(isPresetUrl(`${MINE}/`, saved)).toBe(true);
    expect(isPresetUrl('', saved)).toBe(false);
  });

  it('finds the preset pinned to the current model before one that pins none', () => {
    const list = [
      { label: 'Mine', baseUrl: MINE },
      { label: 'Mine · big', baseUrl: MINE, modelId: 'big' },
    ];
    expect(findSavedPreset(list, ` ${MINE}/ `, 'big')?.label).toBe('Mine · big');
    expect(findSavedPreset(list, MINE, 'other')?.label).toBe('Mine');
    expect(findSavedPreset(list, MINE)?.label).toBe('Mine');
    expect(findSavedPreset([list[1]], MINE, 'other')).toBeUndefined();
    expect(findSavedPreset(undefined, MINE)).toBeUndefined();
  });

  it('adds with a trimmed name, falling back to the endpoint and model', () => {
    expect(addSavedPreset([], '  Mine ', `${MINE}/`)).toEqual(saved);
    expect(addSavedPreset(undefined, ' ', MINE)).toEqual([{ label: 'my.host', baseUrl: MINE }]);
    expect(addSavedPreset(undefined, '', OPENROUTER, 'moonshotai/kimi-k3')).toEqual([
      { label: 'OpenRouter · kimi-k3', baseUrl: OPENROUTER, modelId: 'moonshotai/kimi-k3' },
    ]);
  });

  it('keeps one preset per URL and model, so an endpoint can have several', () => {
    const one = addSavedPreset([], 'Kimi', OPENROUTER, 'moonshotai/kimi-k3');
    const two = addSavedPreset(one, 'GLM', OPENROUTER, 'z-ai/glm-5.3');
    expect(two).toHaveLength(2);
    expect(addSavedPreset(two, 'Again', `${OPENROUTER}/`, 'z-ai/glm-5.3')).toBe(two);
  });

  it('does not add an empty URL or a built-in URL without a model', () => {
    expect(addSavedPreset(saved, 'Again', MINE)).toBe(saved);
    expect(addSavedPreset(saved, 'Nano', 'https://nano-gpt.com/api/v1')).toBe(saved);
    expect(addSavedPreset(saved, 'Blank', '  ', 'some-model')).toBe(saved);
  });

  it('removes only the preset with that URL and model', () => {
    const list = [
      { label: 'Kimi', baseUrl: OPENROUTER, modelId: 'moonshotai/kimi-k3' },
      { label: 'GLM', baseUrl: OPENROUTER, modelId: 'z-ai/glm-5.3' },
    ];
    expect(removeSavedPreset(list, { label: '', baseUrl: `${OPENROUTER}/`, modelId: 'z-ai/glm-5.3' }))
      .toEqual([list[0]]);
    expect(removeSavedPreset(list, { label: '', baseUrl: OPENROUTER })).toEqual(list);
  });

  it('labels a URL by its host, or the URL itself when it does not parse', () => {
    expect(defaultPresetLabel('http://127.0.0.1:4599/char/v1')).toBe('127.0.0.1:4599');
    expect(defaultPresetLabel('not a url')).toBe('not a url');
    expect(suggestPresetLabel(MINE, 'org/model-x')).toBe('my.host · model-x');
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptModelBindingSelect } from '../../../src/components/settings/components/PromptModelBindingSelect';
import type { PromptModelBinding } from '../../../src/db/characterTypes';
import { DEFAULT_SETTINGS } from '../../../src/db/characterTypes';

const NANO = 'https://nano-gpt.com/api/v1';
const OPENROUTER = 'https://openrouter.ai/api/v1';

afterEach(cleanup);

function renderSelect(modelIdsByBaseUrl: Record<string, string>) {
  const onChange = vi.fn<(binding: PromptModelBinding | undefined) => void>();
  render(
    <PromptModelBindingSelect
      binding={{ baseUrl: OPENROUTER, modelId: 'openai/gpt-4o' }}
      globalAi={{ ...DEFAULT_SETTINGS.ai, modelIdsByBaseUrl }}
      modelsByBaseUrl={{}}
      onChange={onChange}
      onFetch={async () => {}}
      isFetching={false}
    />
  );
  fireEvent.change(screen.getByDisplayValue('OpenRouter'), { target: { value: NANO } });
  return onChange;
}

describe('PromptModelBindingSelect saved presets', () => {
  it('lists a saved preset by its name instead of its URL', () => {
    const MINE = 'https://my.host/v1';
    render(
      <PromptModelBindingSelect
        binding={{ baseUrl: MINE, modelId: 'mine-model' }}
        globalAi={{
          ...DEFAULT_SETTINGS.ai,
          apiKeysByBaseUrl: { [MINE]: 'sk-mine' },
          customBaseUrlPresets: [{ label: 'Mine', baseUrl: MINE }],
        }}
        modelsByBaseUrl={{}}
        onChange={vi.fn()}
        onFetch={async () => {}}
        isFetching={false}
      />
    );
    expect(screen.getByRole('option', { name: 'Mine' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: `Custom: ${MINE}` })).toBeNull();
  });

  it('lists each endpoint once, however many model presets it has', () => {
    const MINE = 'https://my.host/v1';
    render(
      <PromptModelBindingSelect
        binding={undefined}
        globalAi={{
          ...DEFAULT_SETTINGS.ai,
          customBaseUrlPresets: [
            { label: 'OR Kimi', baseUrl: OPENROUTER, modelId: 'moonshotai/kimi-k3' },
            { label: 'Mine · a', baseUrl: MINE, modelId: 'a' },
            { label: 'Mine · b', baseUrl: MINE, modelId: 'b' },
          ],
        }}
        modelsByBaseUrl={{}}
        onChange={vi.fn()}
        onFetch={async () => {}}
        isFetching={false}
      />
    );
    const labels = screen.getAllByRole('option').map((option) => option.textContent);
    expect(labels.filter((label) => label === 'OpenRouter')).toHaveLength(1);
    expect(labels).not.toContain('OR Kimi');
    expect(labels.filter((label) => label === 'my.host')).toHaveLength(1);
  });
});

describe('PromptModelBindingSelect endpoint change', () => {
  it('does not carry the previous endpoint model over', () => {
    const onChange = renderSelect({});
    expect(onChange).toHaveBeenCalledWith({ baseUrl: NANO, modelId: '' });
  });

  it('uses the model remembered for the new endpoint', () => {
    const onChange = renderSelect({ [NANO]: 'nano-model' });
    expect(onChange).toHaveBeenCalledWith({ baseUrl: NANO, modelId: 'nano-model' });
  });
});

describe('PromptModelBindingSelect fetch errors', () => {
  function renderWithError(fetchError: string | null, isFetching = false) {
    render(
      <PromptModelBindingSelect
        binding={{ baseUrl: OPENROUTER, modelId: 'openai/gpt-4o' }}
        globalAi={{ ...DEFAULT_SETTINGS.ai, apiKeysByBaseUrl: { [OPENROUTER]: 'sk-or' } }}
        modelsByBaseUrl={{}}
        onChange={vi.fn()}
        onFetch={async () => {}}
        isFetching={isFetching}
        fetchError={fetchError}
      />
    );
  }

  it('shows the error for the selected endpoint', () => {
    renderWithError('Invalid API key');
    expect(screen.getByRole('alert').textContent).toBe("Couldn't load models: Invalid API key");
  });

  it('hides the error while a retry is in flight', () => {
    renderWithError('Invalid API key', true);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

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

  it('lists each endpoint once, and each model preset by name under Saved', () => {
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
    expect(labels.filter((label) => label === 'my.host')).toHaveLength(1);
    const saved = screen.getByRole('group', { name: 'Saved' });
    expect(
      Array.from(saved.querySelectorAll('option')).map((option) => option.textContent)
    ).toEqual(['OR Kimi', 'Mine · a', 'Mine · b']);
  });

  const KIMI = { label: 'OR Kimi', baseUrl: OPENROUTER, modelId: 'moonshotai/kimi-k3' };

  function renderWithPresets(
    binding: PromptModelBinding | undefined,
    modelIdsByBaseUrl: Record<string, string> = {}
  ) {
    const onChange = vi.fn<(binding: PromptModelBinding | undefined) => void>();
    const props = {
      globalAi: { ...DEFAULT_SETTINGS.ai, modelIdsByBaseUrl, customBaseUrlPresets: [KIMI] },
      modelsByBaseUrl: {},
      onChange,
      onFetch: async () => {},
      isFetching: false,
    };
    const view = render(<PromptModelBindingSelect binding={binding} {...props} />);
    const rerender = (next: PromptModelBinding | undefined) =>
      view.rerender(<PromptModelBindingSelect binding={next} {...props} />);
    return { onChange, rerender, select: () => screen.getAllByRole('combobox')[0] as HTMLSelectElement };
  }

  it('routes to a saved preset’s endpoint and model when picked', () => {
    const { onChange, select } = renderWithPresets(undefined);
    fireEvent.change(select(), { target: { value: 'saved:0' } });
    expect(onChange).toHaveBeenCalledWith({ baseUrl: OPENROUTER, modelId: 'moonshotai/kimi-k3' });
  });

  it('shows a mapping that matches a saved preset as that preset', () => {
    const { select } = renderWithPresets({ baseUrl: OPENROUTER, modelId: 'moonshotai/kimi-k3' });
    expect(select().selectedOptions[0].textContent).toBe('OR Kimi');
  });

  it('keeps the plain provider selected when its remembered model is also a preset', () => {
    const { onChange, rerender, select } = renderWithPresets(undefined, {
      [OPENROUTER]: 'moonshotai/kimi-k3',
    });
    fireEvent.change(select(), { target: { value: OPENROUTER } });
    const next = onChange.mock.calls[0][0];
    expect(next).toEqual({ baseUrl: OPENROUTER, modelId: 'moonshotai/kimi-k3' });
    rerender(next);
    expect(select().selectedOptions[0].textContent).toBe('OpenRouter');
  });

  it('drops back to the provider once the model no longer matches the preset', () => {
    const { onChange, rerender, select } = renderWithPresets(undefined);
    fireEvent.change(select(), { target: { value: 'saved:0' } });
    rerender(onChange.mock.calls[0][0]);
    expect(select().selectedOptions[0].textContent).toBe('OR Kimi');
    rerender({ baseUrl: OPENROUTER, modelId: 'openai/gpt-4o' });
    expect(select().selectedOptions[0].textContent).toBe('OpenRouter');
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

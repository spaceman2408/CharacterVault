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

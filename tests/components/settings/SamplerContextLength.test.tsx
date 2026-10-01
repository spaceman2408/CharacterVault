// @vitest-environment jsdom
import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SamplerTab } from '../../../src/components/settings/tabs/SamplerTab';
import { createDefaultDraft } from '../../../src/components/settings/hooks/useSettingsDraft';
import type { SettingsDraft } from '../../../src/components/settings/types';

const drafts: SettingsDraft[] = [];

afterEach(() => {
  cleanup();
  drafts.length = 0;
});

function Harness() {
  const [value, setValue] = useState<SettingsDraft>(() => {
    const initial = createDefaultDraft();
    return { ...initial, sampler: { ...initial.sampler, contextLength: 50000 } };
  });
  useEffect(() => {
    drafts.push(value);
  }, [value]);
  return <SamplerTab draft={value} setDraft={setValue} />;
}

describe('custom context length field', () => {
  it('can be emptied and retyped', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Custom context length in tokens') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(drafts[drafts.length - 1].sampler.contextLength).toBe(50000);

    fireEvent.change(input, { target: { value: '8000' } });
    fireEvent.blur(input);
    expect(input.value).toBe('8000');
    expect(drafts[drafts.length - 1].sampler.contextLength).toBe(8000);
  });

  it('restores the last value when left empty', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Custom context length in tokens') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('50000');
  });
});

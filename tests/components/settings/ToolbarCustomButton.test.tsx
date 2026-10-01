// @vitest-environment jsdom
import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PromptsTab } from '../../../src/components/settings/tabs/PromptsTab';
import { createDefaultDraft } from '../../../src/components/settings/hooks/useSettingsDraft';
import type { SettingsDraft } from '../../../src/components/settings/types';

const drafts: SettingsDraft[] = [];
const latest = () => drafts[drafts.length - 1];

afterEach(() => {
  cleanup();
  drafts.length = 0;
});

function Harness() {
  const [value, setValue] = useState<SettingsDraft>(() => {
    const initial = createDefaultDraft();
    return {
      ...initial,
      toolbar: {
        ...initial.toolbar,
        order: initial.toolbar.order.filter((id) => id !== 'shorten'),
      },
    };
  });
  useEffect(() => {
    drafts.push(value);
  }, [value]);
  return <PromptsTab draft={value} setDraft={setValue} />;
}

function addButton(label: string) {
  fireEvent.change(screen.getByLabelText('Button label'), { target: { value: label } });
  fireEvent.change(screen.getByPlaceholderText('Prompt template: must contain ${text}'), {
    target: { value: 'Do it: ${text}' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

describe('new custom toolbar button', () => {
  it('rejects the label of a hidden built-in button', () => {
    render(<Harness />);
    addButton('shorten');
    expect(screen.getByText('A button labeled "shorten" already exists')).toBeTruthy();
    expect(latest().toolbar.customOps).toEqual([]);
  });

  it('accepts a label no button uses', () => {
    render(<Harness />);
    addButton('Pirate');
    expect(latest().toolbar.customOps.map((op) => op.label)).toEqual(['Pirate']);
  });
});

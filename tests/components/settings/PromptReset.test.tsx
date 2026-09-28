// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PromptsTab } from '../../../src/components/settings/tabs/PromptsTab';
import { CreationStudioTab } from '../../../src/components/settings/tabs/CreationStudioTab';
import type { SettingsDraft } from '../../../src/components/settings/types';
import { DEFAULT_SETTINGS, DEFAULT_STUDIO_SETTINGS } from '../../../src/db/characterTypes';

afterEach(cleanup);

function draft(): SettingsDraft {
  const used: Pick<
    SettingsDraft,
    'ai' | 'prompts' | 'promptModels' | 'toolbar' | 'agentModel' | 'showLuckyVortex' | 'studio'
  > = {
    ai: { ...DEFAULT_SETTINGS.ai },
    prompts: { ...DEFAULT_SETTINGS.prompts, rewrite: 'My own rephrase prompt ${text}' },
    promptModels: {},
    toolbar: { ...DEFAULT_SETTINGS.toolbar },
    agentModel: undefined,
    showLuckyVortex: true,
    studio: {
      ...DEFAULT_STUDIO_SETTINGS,
      prompts: { ...DEFAULT_STUDIO_SETTINGS.prompts, name: 'Name it ${concept}' },
    },
  };
  return used as SettingsDraft;
}

function Harness({ tab: Tab }: { tab: typeof PromptsTab }) {
  const [value, setValue] = useState(draft);
  return <Tab draft={value} setDraft={setValue} />;
}

function headerFor(label: string): HTMLElement {
  return screen.getByText(label).closest('button') as HTMLElement;
}

describe('prompt reset', () => {
  it('marks only edited toolbar prompts and resets one after confirming', () => {
    render(<Harness tab={PromptsTab} />);
    expect(headerFor('Rephrase Prompt').textContent).toContain('edited');
    expect(headerFor('Enhance Prompt').textContent).not.toContain('edited');

    fireEvent.click(headerFor('Rephrase Prompt'));
    fireEvent.click(screen.getByText('Reset to default'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByDisplayValue('My own rephrase prompt ${text}')).toBeTruthy();

    fireEvent.click(screen.getByText('Reset to default'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect((screen.getByPlaceholderText('Enter rewrite prompt...') as HTMLTextAreaElement).value).toBe(
      DEFAULT_SETTINGS.prompts.rewrite,
    );
    expect(headerFor('Rephrase Prompt').textContent).not.toContain('edited');
    expect(screen.queryByText('Reset to default')).toBeNull();
  });

  it('resets one Studio prompt after confirming', () => {
    render(<Harness tab={CreationStudioTab} />);
    expect(headerFor('Name Prompt').textContent).toContain('edited');
    expect(headerFor('System Prompt').textContent).not.toContain('edited');

    fireEvent.click(headerFor('Name Prompt'));
    fireEvent.click(screen.getByText('Reset to default'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(headerFor('Name Prompt').textContent).not.toContain('edited');
  });

  it('asks before resetting all Studio prompts', () => {
    render(<Harness tab={CreationStudioTab} />);

    fireEvent.click(screen.getByText('Reset to defaults'));
    expect(screen.getByText('Reset all Studio prompts?')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(headerFor('Name Prompt').textContent).toContain('edited');

    fireEvent.click(screen.getByText('Reset to defaults'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(headerFor('Name Prompt').textContent).not.toContain('edited');
  });
});

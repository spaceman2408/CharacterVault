// @vitest-environment jsdom
import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkillsTab } from '../../../src/components/settings/tabs/SkillsTab';
import { createDefaultDraft } from '../../../src/components/settings/hooks/useSettingsDraft';
import type { SettingsDraft } from '../../../src/components/settings/types';
import { DEFAULT_AGENT_SKILLS } from '../../../src/db/characterTypes';

const drafts: SettingsDraft[] = [];
const latest = () => drafts[drafts.length - 1];

afterEach(() => {
  cleanup();
  drafts.length = 0;
});

function Harness({ initial }: { initial?: (draft: SettingsDraft) => SettingsDraft }) {
  const [value, setValue] = useState<SettingsDraft>(() => {
    const draft = createDefaultDraft();
    return initial ? initial(draft) : draft;
  });
  useEffect(() => {
    drafts.push(value);
  }, [value]);
  return <SkillsTab draft={value} setDraft={setValue} />;
}

const open = (name: string) => fireEvent.click(screen.getByText(name));
const editorCount = () => screen.queryAllByLabelText('Instructions').length;

describe('SkillsTab', () => {
  it('turns a skill off and back on without losing it', () => {
    render(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'Use Cut AI Slop' });
    fireEvent.click(toggle);
    expect(latest().agentSkills.find((skill) => skill.name === 'Cut AI Slop')?.enabled).toBe(false);
    expect(screen.getByText(DEFAULT_AGENT_SKILLS[2].description)).toBeTruthy();

    fireEvent.click(toggle);
    const back = latest().agentSkills.find((skill) => skill.name === 'Cut AI Slop');
    expect(back).toEqual(DEFAULT_AGENT_SKILLS.find((skill) => skill.name === 'Cut AI Slop'));
  });

  it('switches all skills off and on from the top, keeping each skill as it was', () => {
    render(<Harness />);
    const master = screen.getByRole('switch', { name: 'Use skills' });
    expect(master.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(master);
    expect(latest().agentSkillsEnabled).toBe(false);
    expect(latest().agentSkills).toEqual(DEFAULT_AGENT_SKILLS);
    expect(master.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(master);
    expect(latest().agentSkillsEnabled).toBe(true);
  });

  it('keeps one skill open at a time, with the name edited in the row', () => {
    render(<Harness />);
    open('Greeting Writer');
    expect(editorCount()).toBe(1);
    expect((screen.getByLabelText('Skill name') as HTMLInputElement).value).toBe('Greeting Writer');

    open('Lorebook Entries');
    expect(editorCount()).toBe(1);
    expect((screen.getByLabelText('Skill name') as HTMLInputElement).value).toBe('Lorebook Entries');

    fireEvent.click(screen.getByRole('button', { name: 'Close skill' }));
    expect(editorCount()).toBe(0);
  });

  it('adds a new skill at the top, open, and drops it if closed empty', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(latest().agentSkills[0]).toMatchObject({ name: '', content: '' });
    expect(document.activeElement).toBe(screen.getByLabelText('Skill name'));

    fireEvent.click(screen.getByRole('button', { name: 'Close skill' }));
    expect(latest().agentSkills.map((skill) => skill.name)).toEqual(
      DEFAULT_AGENT_SKILLS.map((skill) => skill.name),
    );
  });

  it('keeps a new skill that has text when another opens', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByLabelText('Skill name'), { target: { value: 'Tone' } });
    open('Greeting Writer');
    expect(latest().agentSkills[0].name).toBe('Tone');
  });

  it('resets an edited default only after confirming', () => {
    render(<Harness />);
    open('Greeting Writer');
    expect(screen.queryByRole('button', { name: /Reset to default/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Mine.' } });
    expect(screen.getByText('Default skill · edited')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reset to default/ }));
    expect(latest().agentSkills[0].content).toBe('Mine.');

    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    expect(latest().agentSkills[0].content).toBe(DEFAULT_AGENT_SKILLS[0].content);
    expect(screen.queryByRole('button', { name: /Reset to default/ })).toBeNull();
  });

  it('deletes only after confirming, then offers the default back', () => {
    render(<Harness />);
    open('Cut AI Slop');
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(latest().agentSkills).toHaveLength(3);

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(latest().agentSkills.map((skill) => skill.name)).not.toContain('Cut AI Slop');

    fireEvent.click(screen.getByRole('button', { name: 'Add back 1 default skill' }));
    expect(latest().agentSkills.map((skill) => skill.name)).toContain('Cut AI Slop');
  });

  it('shows an empty state with no skills', () => {
    render(<Harness initial={(draft) => ({ ...draft, agentSkills: [] })} />);
    expect(screen.getByText(/No skills\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add back 3 default skills' })).toBeTruthy();
  });
});

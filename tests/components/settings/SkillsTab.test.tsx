// @vitest-environment jsdom
import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillsTab } from '../../../src/components/settings/tabs/SkillsTab';
import { createDefaultDraft } from '../../../src/components/settings/hooks/useSettingsDraft';
import type { AddToast, SettingsDraft } from '../../../src/components/settings/types';
import { DEFAULT_AGENT_SKILLS } from '../../../src/db/characterTypes';
import * as skillTransfer from '../../../src/services/agentSkillTransfer';

const drafts: SettingsDraft[] = [];
const latest = () => drafts[drafts.length - 1];

afterEach(() => {
  cleanup();
  drafts.length = 0;
  vi.restoreAllMocks();
});

function Harness({
  initial,
  addToast,
}: {
  initial?: (draft: SettingsDraft) => SettingsDraft;
  addToast?: AddToast;
}) {
  const [value, setValue] = useState<SettingsDraft>(() => {
    const draft = createDefaultDraft();
    return initial ? initial(draft) : draft;
  });
  useEffect(() => {
    drafts.push(value);
  }, [value]);
  return <SkillsTab draft={value} setDraft={setValue} addToast={addToast} />;
}

function makeFile(name: string, content: string, type = 'application/json'): File {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
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

  it('opens the agent tools glossary on demand', () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Agent tools glossary' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('read_field')).toBeNull();

    fireEvent.click(toggle);
    const fields = screen.getByRole('region', { name: 'Card fields' });
    expect(within(fields).getByText('read_field')).toBeTruthy();
    const checks = screen.getByRole('region', { name: 'Search and checks' });
    expect(within(checks).getByText('audit_book').closest('div')?.textContent).toContain('Lorebook only');
  });

  it('copies a tool name when clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Agent tools glossary' }));
    const button = screen.getByRole('button', { name: 'Copy read_field' });
    expect(button.textContent).toBe('read_field');

    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledWith('read_field');
    await waitFor(() => expect(button.querySelector('.lucide-check')).not.toBeNull());
  });

  it('exports a single skill from its open editor', () => {
    const downloadSpy = vi.spyOn(skillTransfer, 'downloadSkillExport').mockImplementation(() => {});
    const addToast = vi.fn();
    render(<Harness addToast={addToast} />);

    open('Greeting Writer');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [file, filename] = downloadSpy.mock.calls[0];
    expect(file.kind).toBe(skillTransfer.SKILL_EXPORT_KIND);
    expect(file.skills).toEqual([
      {
        name: DEFAULT_AGENT_SKILLS[0].name,
        description: DEFAULT_AGENT_SKILLS[0].description,
        content: DEFAULT_AGENT_SKILLS[0].content,
      },
    ]);
    expect(filename).toBe('charactervault-skill-greeting-writer.json');
    expect(addToast).toHaveBeenCalledWith('success', 'Exported "Greeting Writer".');
  });

  it('exports all skills in one click and disables export buttons when empty', () => {
    const downloadSpy = vi.spyOn(skillTransfer, 'downloadSkillExport').mockImplementation(() => {});
    const addToast = vi.fn();
    render(<Harness addToast={addToast} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export all' }));
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [file, filename] = downloadSpy.mock.calls[0];
    expect(file.skills).toHaveLength(DEFAULT_AGENT_SKILLS.length);
    expect(filename).toMatch(/^charactervault-skills-\d{4}-\d{2}-\d{2}\.json$/);
    expect(addToast).toHaveBeenCalledWith('success', 'Exported 3 skills.');

    cleanup();
    render(<Harness initial={(draft) => ({ ...draft, agentSkills: [] })} />);
    expect((screen.getByRole('button', { name: 'Export all' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Select to export' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('supports selecting a subset of skills to export, starting with none selected', () => {
    const downloadSpy = vi.spyOn(skillTransfer, 'downloadSkillExport').mockImplementation(() => {});
    const customSkill = {
      id: 'skill-custom',
      name: 'Character to Image',
      description: 'Image prompts.',
      content: 'Read description.',
    };
    render(
      <Harness
        initial={(draft) => ({
          ...draft,
          agentSkills: [customSkill, ...draft.agentSkills],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select to export' }));
    expect(screen.getByText('0 selected')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Export (0)' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('4 selected')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByText('1 selected')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Cut AI Slop for export' }));
    expect(screen.getByText('2 selected')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Export (2)' }));
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy.mock.calls[0][0].skills.map((s) => s.name)).toEqual([
      'Character to Image',
      'Cut AI Slop',
    ]);
    expect(screen.queryByText('2 selected')).toBeNull();
  });

  it('imports a new skill immediately and opens it', async () => {
    const addToast = vi.fn();
    render(<Harness addToast={addToast} />);

    const payload = skillTransfer.buildSkillExportFile([
      {
        id: 'tmp',
        name: 'Character to Image',
        description: 'Build image prompts.',
        content: 'Read description.',
      },
    ]);
    const input = screen.getByLabelText('Import agent skills') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('c2i.json', JSON.stringify(payload))] },
    });

    await waitFor(() => {
      expect(latest().agentSkills[0].name).toBe('Character to Image');
    });
    expect((screen.getByLabelText('Skill name') as HTMLInputElement).value).toBe('Character to Image');
    expect(addToast).toHaveBeenCalledWith('success', 'Imported "Character to Image".');
  });

  it('asks whether to replace or keep both on name conflicts', async () => {
    const addToast = vi.fn();
    render(<Harness addToast={addToast} />);

    const incoming = skillTransfer.buildSkillExportFile([
      {
        id: 'tmp',
        name: 'Greeting Writer',
        description: 'Updated desc.',
        content: 'Updated body.',
      },
    ]);
    const input = screen.getByLabelText('Import agent skills') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [makeFile('greeting.json', JSON.stringify(incoming))] },
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Greeting Writer');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep both' }));
    expect(latest().agentSkills.map((s) => s.name)).toContain('Greeting Writer (2)');
    expect(latest().agentSkills.find((s) => s.id === 'default-greeting-writer')?.content).toBe(
      DEFAULT_AGENT_SKILLS[0].content,
    );

    fireEvent.change(input, {
      target: { files: [makeFile('greeting.json', JSON.stringify(incoming))] },
    });
    const replaceDialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(replaceDialog).getByRole('button', { name: 'Replace' }));
    expect(latest().agentSkills.find((s) => s.id === 'default-greeting-writer')?.content).toBe(
      'Updated body.',
    );
    expect(addToast).toHaveBeenLastCalledWith('success', 'Replaced "Greeting Writer".');
  });

  it('shows an inline error and toast when an uploaded skill file is invalid', async () => {
    const addToast = vi.fn();
    render(<Harness addToast={addToast} />);

    const input = screen.getByLabelText('Import agent skills') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('broken.json', '{not valid')] },
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not parse that file as JSON.');
    expect(addToast).toHaveBeenCalledWith('error', 'Could not parse that file as JSON.');
  });
});

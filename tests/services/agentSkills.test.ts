import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_SKILLS } from '../../src/db/characterTypes';
import {
  cloneDefaultAgentSkills,
  isDefaultAgentSkills,
  isEditedDefaultSkill,
  normalizeAgentSkills,
  resolveAgentSkills,
  validateAgentSkills,
} from '../../src/services/agentSkills';
import {
  applyBackupToDraft,
  buildSettingsBackup,
  parseSettingsBackup,
} from '../../src/services/SettingsBackupService';
import { createDefaultDraft } from '../../src/components/settings/hooks/useSettingsDraft';

describe('agent skills settings', () => {
  it('uses the defaults until the list is stored', () => {
    expect(resolveAgentSkills(undefined)).toEqual(DEFAULT_AGENT_SKILLS);
    expect(resolveAgentSkills([])).toEqual([]);
  });

  it('recognizes an unedited default list', () => {
    const skills = cloneDefaultAgentSkills();
    expect(isDefaultAgentSkills(skills)).toBe(true);
    skills[0] = { ...skills[0], content: `${skills[0].content}\nMore.` };
    expect(isDefaultAgentSkills(skills)).toBe(false);
    expect(isDefaultAgentSkills(cloneDefaultAgentSkills().slice(1))).toBe(false);
  });

  it('every default skill is usable and uniquely named', () => {
    expect(validateAgentSkills(DEFAULT_AGENT_SKILLS)).toBeNull();
    for (const skill of DEFAULT_AGENT_SKILLS) {
      expect(skill.name.trim()).not.toBe('');
      expect(skill.description.trim()).not.toBe('');
      expect(skill.content.trim()).not.toBe('');
    }
  });

  it('rejects duplicate names and nameless skills with content', () => {
    const base = { description: '', content: 'x' };
    expect(
      validateAgentSkills([
        { id: '1', name: 'Tone', ...base },
        { id: '2', name: ' tone ', ...base },
      ]),
    ).toContain('two skills are named');
    expect(validateAgentSkills([{ id: '1', name: '', ...base }])).toContain('needs a name');
    expect(validateAgentSkills([{ id: '1', name: '', description: '', content: '' }])).toBeNull();
  });

  it('normalizes stored values', () => {
    expect(normalizeAgentSkills('nope')).toBeUndefined();
    const [skill] = normalizeAgentSkills([{ name: 'A', content: 5 }, null]) ?? [];
    expect(skill.name).toBe('A');
    expect(skill.content).toBe('');
    expect(skill.id).toMatch(/^skill-/);
  });
});

describe('agent skills in settings backups', () => {
  const saved = {
    id: 'app-settings' as const,
    ui: { theme: 'system' as const, editorFontSize: 16, sidebarWidth: 280 },
    version: 1,
  };

  it('exports the defaults when none are stored', () => {
    const file = buildSettingsBackup(saved, false);
    expect(file.settings.agentSkills).toEqual(DEFAULT_AGENT_SKILLS);
  });

  it('round-trips custom skills into the draft', () => {
    const custom = [{ id: 'x', name: 'Mine', description: 'Use always.', content: 'Do it.' }];
    const file = parseSettingsBackup(
      JSON.parse(JSON.stringify(buildSettingsBackup({ ...saved, agentSkills: custom }, false))),
    );
    expect(applyBackupToDraft(createDefaultDraft(), file).agentSkills).toEqual(custom);
  });

  it('keeps the current skills when a backup predates skills', () => {
    const file = buildSettingsBackup(saved, false);
    delete file.settings.agentSkills;
    const draft = { ...createDefaultDraft(), agentSkills: [{ id: 'y', name: 'Keep', description: '', content: 'k' }] };
    expect(applyBackupToDraft(draft, parseSettingsBackup(file)).agentSkills).toEqual(draft.agentSkills);
  });
});

describe('agent skill on/off and defaults', () => {
  it('stores a turned-off default list, since it is no longer the defaults', () => {
    const skills = cloneDefaultAgentSkills();
    skills[2] = { ...skills[2], enabled: false };
    expect(isDefaultAgentSkills(skills)).toBe(false);
  });

  it('keeps only enabled: false when normalizing', () => {
    const [off, on, junk] =
      normalizeAgentSkills([
        { id: 'a', name: 'A', content: 'x', enabled: false },
        { id: 'b', name: 'B', content: 'x', enabled: true },
        { id: 'c', name: 'C', content: 'x', enabled: 'no' },
      ]) ?? [];
    expect(off.enabled).toBe(false);
    expect('enabled' in on).toBe(false);
    expect('enabled' in junk).toBe(false);
  });

  it('flags a default only when its text differs from the shipped one', () => {
    const [builtin] = cloneDefaultAgentSkills();
    expect(isEditedDefaultSkill(builtin)).toBe(false);
    expect(isEditedDefaultSkill({ ...builtin, enabled: false })).toBe(false);
    expect(isEditedDefaultSkill({ ...builtin, content: 'Mine.' })).toBe(true);
    expect(isEditedDefaultSkill({ id: 'skill-x', name: 'X', description: '', content: 'x' })).toBe(false);
  });
});

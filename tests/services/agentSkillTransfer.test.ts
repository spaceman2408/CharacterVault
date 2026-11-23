import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_SKILLS } from '../../src/db/characterTypes';
import { validateAgentSkills } from '../../src/services/agentSkills';
import {
  buildSkillExportFile,
  buildSkillExportFilename,
  findImportConflicts,
  mergeImportedSkills,
  parseSkillFiles,
  parseSkillJson,
  parseSkillMarkdown,
  parseSkillText,
  SKILL_EXPORT_KIND,
  SKILL_EXPORT_VERSION,
  slugifySkillName,
} from '../../src/services/agentSkillTransfer';

describe('agentSkillTransfer export', () => {
  it('builds a portable JSON envelope omitting id and enabled', () => {
    const now = new Date('2026-11-22T18:30:00.000Z');
    const file = buildSkillExportFile(
      [
        {
          id: 'skill-123',
          name: '  Character to Image  ',
          description: '  Make prompts.  ',
          content: 'Step 1.',
          enabled: false,
        },
        { id: 'blank', name: '   ', description: 'skip', content: 'skip' },
      ],
      now,
    );

    expect(file).toEqual({
      kind: SKILL_EXPORT_KIND,
      version: SKILL_EXPORT_VERSION,
      exportedAt: '2026-11-22T18:30:00.000Z',
      skills: [
        {
          name: 'Character to Image',
          description: 'Make prompts.',
          content: 'Step 1.',
        },
      ],
    });
  });

  it('throws when no named skills are provided', () => {
    expect(() =>
      buildSkillExportFile([{ id: '1', name: ' ', description: '', content: 'x' }]),
    ).toThrow('No named skills to export.');
  });

  it('generates slug filenames for single exports and dated filenames for bulk', () => {
    const now = new Date('2026-11-22T18:30:00.000Z');
    expect(buildSkillExportFilename([{ name: 'Character to Image!' }], now)).toBe(
      'charactervault-skill-character-to-image.json',
    );
    expect(buildSkillExportFilename([{ name: 'A' }, { name: 'B' }], now)).toBe(
      'charactervault-skills-2026-11-22.json',
    );
    expect(slugifySkillName('   !!!   ')).toBe('skill');
  });
});

describe('agentSkillTransfer parsing', () => {
  it('round-trips single and bulk CharacterVault skill envelopes', () => {
    const exported = buildSkillExportFile(DEFAULT_AGENT_SKILLS);
    const parsed = parseSkillJson(JSON.parse(JSON.stringify(exported)));
    expect(parsed).toEqual(exported.skills);
  });

  it('accepts raw single-skill JSON objects and bare skill arrays', () => {
    expect(parseSkillJson({ name: 'Tone', description: 'Keep it crisp.', content: 'Short sentences.' })).toEqual([
      { name: 'Tone', description: 'Keep it crisp.', content: 'Short sentences.' },
    ]);
    expect(
      parseSkillJson([
        { name: 'One', content: 'A' },
        { name: 'Two', description: 'D', content: 'B' },
      ]),
    ).toEqual([
      { name: 'One', description: '', content: 'A' },
      { name: 'Two', description: 'D', content: 'B' },
    ]);
  });

  it('rejects full settings backups, wrong kinds, wrong versions, and invalid shapes', () => {
    expect(() => parseSkillJson({ kind: 'charactervault-settings', version: 1 })).toThrow(
      /Backup tab/,
    );
    expect(() => parseSkillJson({ kind: 'other', version: 1, skills: [] })).toThrow(
      /not a CharacterVault skill export/,
    );
    expect(() => parseSkillJson({ kind: SKILL_EXPORT_KIND, version: 99, skills: [] })).toThrow(
      /Unsupported skill file version/,
    );
    expect(() => parseSkillJson({ name: 'package-json-lookalike', description: 'nope' })).toThrow(
      /not a valid CharacterVault skill export/,
    );
    expect(() => parseSkillText('{bad json', 'broken.json')).toThrow(/parse that file as JSON/);
  });

  it('parses Markdown skill files with YAML frontmatter or headings', () => {
    const md = `---
name: "Character to Image"
description: 'Use for image prompts.'
---

1. Read description.
2. Output prompts.
`;
    expect(parseSkillMarkdown(md, 'SKILL.md')).toEqual({
      name: 'Character to Image',
      description: 'Use for image prompts.',
      content: '1. Read description.\n2. Output prompts.',
    });

    expect(parseSkillText('# Dialogue Polish\n\nTrim filler.', 'dialogue.md')).toEqual([
      { name: 'Dialogue Polish', description: '', content: 'Trim filler.' },
    ]);

    expect(parseSkillText('Keep beats tight.', 'scene-pacing.md')).toEqual([
      { name: 'scene pacing', description: '', content: 'Keep beats tight.' },
    ]);
  });

  it('reads multi-line frontmatter values', () => {
    const folded = `---
name: Scene Pacing
description: >-
  Use when a scene drags
  or rushes.

  Not for dialogue.
metadata:
  name: ignored
---
Keep beats tight.`;
    expect(parseSkillMarkdown(folded)).toEqual({
      name: 'Scene Pacing',
      description: 'Use when a scene drags or rushes.\nNot for dialogue.',
      content: 'Keep beats tight.',
    });

    const literal = `---
name: Lore Check
description: |
  Line one
    indented
  Line three
---
Body.`;
    expect(parseSkillMarkdown(literal).description).toBe('Line one\n  indented\nLine three');

    const plain = `---
name: Voice Match
description: Use when matching
  a character's voice.
---
Body.`;
    expect(parseSkillMarkdown(plain).description).toBe("Use when matching a character's voice.");
  });

  it('disambiguates duplicate names across multi-file imports', () => {
    const parsed = parseSkillFiles([
      { name: 'a.json', text: JSON.stringify({ name: 'Tone', content: 'First' }) },
      { name: 'b.json', text: JSON.stringify({ name: 'tone', content: 'Second' }) },
    ]);
    expect(parsed.map((skill) => skill.name)).toEqual(['Tone', 'tone (2)']);
  });

  it('prefixes filename in errors when importing multiple files', () => {
    expect(() =>
      parseSkillFiles([
        { name: 'good.json', text: JSON.stringify({ name: 'Good', content: 'Ok' }) },
        { name: 'bad.json', text: 'not json' },
      ]),
    ).toThrow(/^bad\.json:/);
  });
});

describe('agentSkillTransfer conflict detection and merge', () => {
  it('detects case-insensitive name collisions and ignores blank rows', () => {
    const existing = [
      { id: 'blank', name: '', description: '', content: '' },
      ...DEFAULT_AGENT_SKILLS,
    ];
    expect(
      findImportConflicts(existing, [
        { name: 'greeting writer', description: '', content: 'New' },
        { name: 'Character to Image', description: '', content: 'New' },
      ]),
    ).toEqual(['greeting writer']);
  });

  it('replaces matching skills in-place while preserving their id (including defaults)', () => {
    const result = mergeImportedSkills(
      DEFAULT_AGENT_SKILLS,
      [
        { name: 'Greeting Writer', description: 'Updated', content: 'New body.' },
        { name: 'Character to Image', description: 'Image prompts.', content: 'Steps.' },
      ],
      'replace',
    );

    expect(validateAgentSkills(result.skills)).toBeNull();
    expect(result.replaced).toHaveLength(1);
    expect(result.replaced[0].id).toBe('default-greeting-writer');
    expect(result.added).toHaveLength(1);
    expect(result.added[0].name).toBe('Character to Image');
    expect(result.skills[0].name).toBe('Character to Image');
    expect(result.skills.find((s) => s.id === 'default-greeting-writer')?.content).toBe('New body.');
  });

  it('keeps a replaced skill switched off', () => {
    const result = mergeImportedSkills(
      [{ id: 'custom-1', name: 'Mine', description: '', content: 'Old', enabled: false }],
      [{ name: 'Mine', description: 'New', content: 'New body.' }],
      'replace',
    );
    expect(result.replaced[0]).toEqual({
      id: 'custom-1',
      name: 'Mine',
      description: 'New',
      content: 'New body.',
      enabled: false,
    });
  });

  it('keeps both skills by generating unique numbered names', () => {
    const existing = [
      ...DEFAULT_AGENT_SKILLS,
      { id: 'custom-1', name: 'Cut AI Slop (2)', description: '', content: 'Mine' },
    ];
    const result = mergeImportedSkills(
      existing,
      [{ name: 'Cut AI Slop', description: 'Imported', content: 'Other' }],
      'keep-both',
    );

    expect(validateAgentSkills(result.skills)).toBeNull();
    expect(result.replaced).toHaveLength(0);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].name).toBe('Cut AI Slop (3)');
  });

  it('drops blank unsaved rows when merging imported skills', () => {
    const existing = [
      { id: 'unsaved', name: '', description: '', content: '' },
      ...DEFAULT_AGENT_SKILLS,
    ];
    const result = mergeImportedSkills(
      existing,
      [{ name: 'Character to Image', description: 'Prompts', content: 'Body' }],
      'keep-both',
    );
    expect(result.skills.some((s) => s.id === 'unsaved')).toBe(false);
    expect(result.skills).toHaveLength(DEFAULT_AGENT_SKILLS.length + 1);
  });
});

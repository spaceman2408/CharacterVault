import type { AgentSkill } from '../db/characterTypes';
import { createAgentSkillId } from './agentSkills';

export const SKILL_EXPORT_KIND = 'charactervault-skills';
export const SKILL_EXPORT_VERSION = 1;

export interface PortableAgentSkill {
  name: string;
  description: string;
  content: string;
}

export interface AgentSkillExportFile {
  kind: typeof SKILL_EXPORT_KIND;
  version: typeof SKILL_EXPORT_VERSION;
  exportedAt: string;
  skills: PortableAgentSkill[];
}

export type SkillImportConflictStrategy = 'replace' | 'keep-both';

export interface SkillImportMergeResult {
  skills: AgentSkill[];
  added: AgentSkill[];
  replaced: AgentSkill[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function skillNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function isBlankSkill(skill: Pick<AgentSkill, 'name' | 'description' | 'content'>): boolean {
  return !skill.name.trim() && !skill.description.trim() && !skill.content.trim();
}

export function exportableAgentSkills(skills: readonly AgentSkill[]): AgentSkill[] {
  return skills.filter((skill) => skill.name.trim().length > 0);
}

export function slugifySkillName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return slug || 'skill';
}

export function buildSkillExportFilename(
  skills: readonly Pick<AgentSkill, 'name'>[],
  now: Date = new Date(),
): string {
  if (skills.length === 1) {
    return `charactervault-skill-${slugifySkillName(skills[0].name)}.json`;
  }
  const stamp = now.toISOString().slice(0, 10);
  return `charactervault-skills-${stamp}.json`;
}

export function buildSkillExportFile(
  skills: readonly AgentSkill[],
  now: Date = new Date(),
): AgentSkillExportFile {
  const valid = exportableAgentSkills(skills);
  if (valid.length === 0) {
    throw new Error('No named skills to export.');
  }
  return {
    kind: SKILL_EXPORT_KIND,
    version: SKILL_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    skills: valid.map((skill) => ({
      name: skill.name.trim(),
      description: skill.description.trim(),
      content: skill.content,
    })),
  };
}

export function downloadSkillExport(file: AgentSkillExportFile, filename: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Delay revocation so Firefox finishes reading the blob URL before it is freed.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function makeUniqueSkillName(baseName: string, takenKeys: ReadonlySet<string>): string {
  const trimmed = baseName.trim();
  if (!takenKeys.has(skillNameKey(trimmed))) return trimmed;
  let suffix = 2;
  while (takenKeys.has(skillNameKey(`${trimmed} (${suffix})`))) {
    suffix += 1;
  }
  return `${trimmed} (${suffix})`;
}

function disambiguateBatch(skills: readonly PortableAgentSkill[]): PortableAgentSkill[] {
  const seen = new Set<string>();
  return skills.map((skill) => {
    const name = makeUniqueSkillName(skill.name, seen);
    seen.add(skillNameKey(name));
    return name === skill.name ? skill : { ...skill, name };
  });
}

function parsePortableSkill(raw: unknown, requireContentField: boolean): PortableAgentSkill | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== 'string') return null;
  const name = raw.name.trim();
  if (!name) return null;
  if (requireContentField && typeof raw.content !== 'string') return null;
  return {
    name,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    content: typeof raw.content === 'string' ? raw.content : '',
  };
}

export function parseSkillJson(input: unknown): PortableAgentSkill[] {
  if (Array.isArray(input)) {
    const skills = input
      .map((item) => parsePortableSkill(item, true))
      .filter((item): item is PortableAgentSkill => item !== null);
    if (skills.length === 0) {
      throw new Error('That file does not contain any valid skills.');
    }
    return disambiguateBatch(skills);
  }

  if (!isRecord(input)) {
    throw new Error('That file is not a valid CharacterVault skill export.');
  }

  if ('kind' in input) {
    if (input.kind === 'charactervault-settings') {
      throw new Error('That file is a full settings backup. Import it from the Backup tab instead.');
    }
    if (input.kind !== SKILL_EXPORT_KIND) {
      throw new Error('That file is not a CharacterVault skill export.');
    }
    if (input.version !== SKILL_EXPORT_VERSION) {
      throw new Error(
        `Unsupported skill file version (${String(input.version)}). Expected version ${SKILL_EXPORT_VERSION}.`,
      );
    }
    if (!Array.isArray(input.skills)) {
      throw new Error('Skill file is missing its skills list.');
    }
    const skills = input.skills
      .map((item) => parsePortableSkill(item, false))
      .filter((item): item is PortableAgentSkill => item !== null);
    if (skills.length === 0) {
      throw new Error('Skill file does not contain any valid skills.');
    }
    return disambiguateBatch(skills);
  }

  const single = parsePortableSkill(input, true);
  if (!single) {
    throw new Error('That file is not a valid CharacterVault skill export.');
  }
  return [single];
}

function unquoteYamlScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function filenameStem(filename: string | undefined): string {
  if (!filename) return '';
  const base = filename.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '');
  if (!base || base.toLowerCase() === 'skill') return '';
  return base.replace(/[-_]+/g, ' ').trim();
}

export function parseSkillMarkdown(text: string, filename?: string): PortableAgentSkill {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  let name = '';
  let description = '';
  let body = normalized;

  const fmMatch = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const entry = /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
      if (!entry) continue;
      const key = entry[1].toLowerCase();
      const value = unquoteYamlScalar(entry[2]);
      if (key === 'name' && value) name = value;
      if (key === 'description' && value) description = value;
    }
    body = normalized.slice(fmMatch[0].length);
  }

  let content = body.trim();
  if (!name) {
    const headingMatch = /^#\s+(.+?)\s*(?:\n|$)/.exec(content);
    if (headingMatch) {
      name = headingMatch[1].trim();
      content = content.slice(headingMatch[0].length).trim();
    } else {
      name = filenameStem(filename);
    }
  }

  if (!name || !content) {
    throw new Error('Could not read a named skill with instructions from that Markdown file.');
  }

  return { name, description, content };
}

export function parseSkillText(text: string, filename?: string): PortableAgentSkill[] {
  const isMarkdown = filename ? /\.md$/i.test(filename) : false;
  if (isMarkdown) {
    return [parseSkillMarkdown(text, filename)];
  }
  try {
    return parseSkillJson(JSON.parse(text));
  } catch (err) {
    if (err instanceof SyntaxError) {
      if (/^\uFEFF?---\r?\n/.test(text)) {
        return [parseSkillMarkdown(text, filename)];
      }
      throw new Error('Could not parse that file as JSON.');
    }
    throw err;
  }
}

export function parseSkillFiles(
  files: readonly { name: string; text: string }[],
): PortableAgentSkill[] {
  if (files.length === 0) {
    throw new Error('No files selected.');
  }
  const collected: PortableAgentSkill[] = [];
  for (const file of files) {
    try {
      collected.push(...parseSkillText(file.text, file.name));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read skill file.';
      throw new Error(files.length > 1 ? `${file.name}: ${message}` : message);
    }
  }
  return disambiguateBatch(collected);
}

export function findImportConflicts(
  existing: readonly AgentSkill[],
  incoming: readonly PortableAgentSkill[],
): string[] {
  const existingKeys = new Set(
    existing
      .filter((skill) => !isBlankSkill(skill) && skill.name.trim().length > 0)
      .map((skill) => skillNameKey(skill.name)),
  );
  return incoming
    .filter((skill) => existingKeys.has(skillNameKey(skill.name)))
    .map((skill) => skill.name);
}

export function mergeImportedSkills(
  existing: readonly AgentSkill[],
  incoming: readonly PortableAgentSkill[],
  strategy: SkillImportConflictStrategy,
): SkillImportMergeResult {
  const retained = existing.filter((skill) => !isBlankSkill(skill)).map((skill) => ({ ...skill }));
  const takenKeys = new Set(retained.map((skill) => skillNameKey(skill.name)));
  const added: AgentSkill[] = [];
  const replaced: AgentSkill[] = [];

  for (const item of incoming) {
    const key = skillNameKey(item.name);
    const matchIndex = retained.findIndex((skill) => skillNameKey(skill.name) === key);
    if (matchIndex !== -1 && strategy === 'replace') {
      const updated: AgentSkill = {
        id: retained[matchIndex].id,
        name: item.name.trim(),
        description: item.description.trim(),
        content: item.content,
      };
      retained[matchIndex] = updated;
      replaced.push(updated);
      continue;
    }

    const uniqueName = makeUniqueSkillName(item.name, takenKeys);
    takenKeys.add(skillNameKey(uniqueName));
    const created: AgentSkill = {
      id: createAgentSkillId(),
      name: uniqueName,
      description: item.description.trim(),
      content: item.content,
    };
    added.push(created);
  }

  return {
    skills: [...added, ...retained],
    added,
    replaced,
  };
}

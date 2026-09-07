import JSZip from 'jszip';
import { characterImportService } from './CharacterImportService';
import { characterSettingsService } from './CharacterSettingsService';
import { FULL_BACKUP_KIND, FULL_BACKUP_VERSION, type FullBackupManifest } from './CharacterExportService';
import { lorebookService, nameFromLorebookFile } from './LorebookService';
import {
  normalizeBackupData,
  parseSettingsBackup,
  type SettingsBackupFile,
} from './SettingsBackupService';
import { notifyFavoritesChanged, setFavoriteTags } from '../pages/ai-creation-studio/tags/tagData';

export interface RestorePreview {
  mode: 'full' | 'legacy';
  manifest: FullBackupManifest | null;
  settings: SettingsBackupFile | null;
  settingsError: string | null;
  characterPaths: string[];
  lorebookPaths: string[];
  skippedCount: number;
  exportedAt: string | null;
  includeKeys: boolean;
}

export interface LoadedRestore {
  zip: JSZip;
  preview: RestorePreview;
}

export interface RestoreResult {
  charactersImported: number;
  charactersFailed: number;
  lorebooksImported: number;
  lorebooksFailed: number;
  settingsApplied: boolean;
  errors: { path: string; error: string }[];
}

export type RestoreProgress = (done: number, total: number) => void;

function cleanZipPath(raw: string): string {
  return raw.replace(/^\.\//, '').replace(/^\/+/, '');
}

function isSkippable(path: string): boolean {
  return path.split('/').some((segment) => segment === '__MACOSX' || segment.startsWith('.'));
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function mimeForCharacter(path: string): string {
  return path.toLowerCase().endsWith('.png') ? 'image/png' : 'application/json';
}

function parseManifest(input: unknown): FullBackupManifest {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Backup manifest is not valid.');
  }
  const raw = input as Record<string, unknown>;
  if (raw.kind !== FULL_BACKUP_KIND) {
    throw new Error('That file is not a CharacterVault full backup.');
  }
  if (raw.version !== FULL_BACKUP_VERSION) {
    throw new Error(`Unsupported backup version (${String(raw.version)}). Expected version 1.`);
  }
  const counts = (raw.counts ?? {}) as Record<string, unknown>;
  return {
    kind: FULL_BACKUP_KIND,
    version: FULL_BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    includeKeys: raw.includeKeys === true,
    counts: {
      characters: typeof counts.characters === 'number' ? counts.characters : 0,
      lorebooks: typeof counts.lorebooks === 'number' ? counts.lorebooks : 0,
    },
  };
}

export class VaultRestoreService {
  async loadPreview(file: File): Promise<LoadedRestore> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(await file.arrayBuffer());
    } catch {
      throw new Error('That file is not a readable ZIP archive.');
    }

    const characterPaths: string[] = [];
    const lorebookPaths: string[] = [];
    let skippedCount = 0;
    let manifest: FullBackupManifest | null = null;
    let settings: SettingsBackupFile | null = null;
    let settingsError: string | null = null;

    const manifestEntry = zip.file('manifest.json');
    if (manifestEntry) {
      try {
        manifest = parseManifest(JSON.parse(await manifestEntry.async('string')));
      } catch (err) {
        throw err instanceof Error ? err : new Error('Backup manifest is not valid.');
      }
    }

    const settingsEntry = zip.file('settings.json');
    if (settingsEntry) {
      try {
        settings = parseSettingsBackup(JSON.parse(await settingsEntry.async('string')));
      } catch (err) {
        settingsError = err instanceof Error ? err.message : 'Settings entry is not valid.';
      }
    }

    const paths = Object.keys(zip.files).sort();
    for (const rawPath of paths) {
      const entry = zip.files[rawPath];
      const path = cleanZipPath(rawPath);
      if (!entry || entry.dir || isSkippable(path)) continue;
      const lower = path.toLowerCase();
      if (lower === 'manifest.json' || lower === 'settings.json') continue;
      if (lower.startsWith('lorebooks/') && lower.endsWith('.json')) {
        lorebookPaths.push(path);
      } else if (lower.startsWith('characters/') && (lower.endsWith('.png') || lower.endsWith('.json'))) {
        characterPaths.push(path);
      } else if (!lower.includes('/') && (lower.endsWith('.png') || lower.endsWith('.json'))) {
        characterPaths.push(path);
      } else {
        skippedCount += 1;
      }
    }

    return {
      zip,
      preview: {
        mode: manifest ? 'full' : 'legacy',
        manifest,
        settings,
        settingsError,
        characterPaths,
        lorebookPaths,
        skippedCount,
        exportedAt: manifest?.exportedAt ?? settings?.exportedAt ?? null,
        includeKeys: settings?.includeKeys ?? false,
      },
    };
  }

  async restore(loaded: LoadedRestore, onProgress?: RestoreProgress): Promise<RestoreResult> {
    const { zip, preview } = loaded;
    const errors: { path: string; error: string }[] = [];
    let charactersImported = 0;
    let charactersFailed = 0;
    let lorebooksImported = 0;
    let lorebooksFailed = 0;

    const total = preview.characterPaths.length + preview.lorebookPaths.length;
    let done = 0;
    const tick = () => {
      done += 1;
      onProgress?.(done, total);
    };

    for (const path of preview.characterPaths) {
      try {
        const entry = zip.file(path);
        if (!entry) throw new Error('Entry is missing from the archive.');
        const bytes = await entry.async('arraybuffer');
        const file = new File([bytes], basename(path), { type: mimeForCharacter(path) });
        const result = await characterImportService.importFromFile(file);
        if (result.success) {
          charactersImported += 1;
        } else {
          charactersFailed += 1;
          errors.push({ path, error: result.error || 'Import failed.' });
        }
      } catch (err) {
        charactersFailed += 1;
        errors.push({ path, error: err instanceof Error ? err.message : 'Import failed.' });
      }
      tick();
    }

    for (const path of preview.lorebookPaths) {
      try {
        const entry = zip.file(path);
        if (!entry) throw new Error('Entry is missing from the archive.');
        const data = JSON.parse(await entry.async('string'));
        await lorebookService.importFromData(data, nameFromLorebookFile(basename(path)));
        lorebooksImported += 1;
      } catch (err) {
        lorebooksFailed += 1;
        errors.push({ path, error: err instanceof Error ? err.message : 'Import failed.' });
      }
      tick();
    }

    let settingsApplied = false;
    if (preview.settings && !preview.settingsError) {
      await this.applySettingsBackup(preview.settings);
      settingsApplied = true;
    }

    return {
      charactersImported,
      charactersFailed,
      lorebooksImported,
      lorebooksFailed,
      settingsApplied,
      errors,
    };
  }

  async applySettingsBackup(backup: SettingsBackupFile): Promise<void> {
    const data = normalizeBackupData(backup.settings);

    if (backup.includeKeys) {
      await characterSettingsService.saveAllAISettings(
        data.ai,
        data.sampler,
        data.prompts,
        data.promptModels,
        data.agentModel,
      );
    } else {
      const current = await characterSettingsService.getAISettings();
      await characterSettingsService.saveAllAISettings(
        {
          ...data.ai,
          apiKey: current.apiKey,
          apiKeysByBaseUrl: current.apiKeysByBaseUrl,
        },
        data.sampler,
        data.prompts,
        data.promptModels,
        data.agentModel,
      );
    }

    const currentSettings = await characterSettingsService.getSettings();
    const spellcheck = data.ui.spellcheck ?? { enabled: true, language: 'en', ignoredWords: [], customWords: [] };
    await characterSettingsService.saveSettings({
      ...currentSettings,
      ui: {
        ...currentSettings.ui,
        showLuckyVortex: data.ui.showLuckyVortex ?? true,
        markdownImageOpenLinks: data.ui.markdownImageOpenLinks ?? true,
        defaultChatPanel: data.ui.defaultChatPanel ?? 'orion',
        requireAgentReview: data.ui.requireAgentReview ?? false,
      },
      sectionOrder: data.sectionOrder,
      hiddenSections: data.hiddenSections,
      contextSectionIds: data.contextSectionIds,
      studio: data.studio,
    });

    const storedSpell = await characterSettingsService.getSpellcheckSettings();
    await characterSettingsService.saveSpellcheckSettings({
      enabled: spellcheck.enabled,
      language: spellcheck.language,
      ignoredWords: [...new Set([...storedSpell.ignoredWords, ...spellcheck.ignoredWords])],
      customWords: [...new Set([...storedSpell.customWords, ...spellcheck.customWords])],
    });

    setFavoriteTags(data.studioFavorites);
    notifyFavoritesChanged();
  }
}

export const vaultRestoreService = new VaultRestoreService();

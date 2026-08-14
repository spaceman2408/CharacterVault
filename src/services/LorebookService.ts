/**
 * Standalone lorebook vault operations (CRUD, import into vault).
 */

import { characterDb, toLorebookListItem } from '../db/CharacterDatabase';
import type {
  CharacterBook,
  CreateVaultLorebookInput,
  LorebookListItem,
  UpdateVaultLorebookInput,
  VaultLorebook,
} from '../db/characterTypes';
import { createEmptyCharacterBook } from '../db/characterTypes';
import { convertToSTLorebook, importLorebook } from './LorebookConverter';

/** Filename stem used as the imported book name. Keeps Windows copy suffixes. */
export function nameFromLorebookFile(fileName: string): string {
  return fileName.replace(/\.json$/i, '').trim();
}

function sanitizeFilename(name: string, suffix: string): string {
  // eslint-disable-next-line no-control-regex
  let sanitized = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  sanitized = sanitized.replace(/[.\s]+$/, '');
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(sanitized)) {
    sanitized += '_';
  }
  const maxLength = 200 - suffix.length;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).replace(/[.\s]+$/, '');
  }
  return (sanitized || 'lorebook') + suffix;
}

export class LorebookService {
  async listItems(): Promise<LorebookListItem[]> {
    return characterDb.getAllLorebookListItems();
  }

  async get(id: string): Promise<VaultLorebook | undefined> {
    return characterDb.getLorebook(id);
  }

  async create(input: CreateVaultLorebookInput): Promise<VaultLorebook> {
    return characterDb.createLorebook(input);
  }

  async update(id: string, input: UpdateVaultLorebookInput): Promise<VaultLorebook> {
    return characterDb.updateLorebook(id, input);
  }

  async updateBook(id: string, book: CharacterBook): Promise<VaultLorebook> {
    return characterDb.updateLorebook(id, {
      book,
      name: book.name?.trim() || undefined,
      description: book.description,
    });
  }

  async delete(id: string): Promise<void> {
    return characterDb.deleteLorebook(id);
  }

  async duplicate(id: string, newName: string): Promise<VaultLorebook> {
    return characterDb.duplicateLorebook(id, newName);
  }

  async markOpened(id: string): Promise<string> {
    return characterDb.updateLorebookLastOpened(id);
  }

  /**
   * Import ST/CV lorebook JSON into the vault as a new standalone book.
   * When preferredName is set (file import), it wins over the name inside the JSON
   * so download suffixes like "(1)" stay on the vault book.
   */
  async importFromData(data: unknown, preferredName?: string): Promise<VaultLorebook> {
    const book = importLorebook(data);
    if (!book) {
      throw new Error('Could not recognize the lorebook format');
    }

    const name =
      (preferredName ?? '').trim() || (book.name || '').trim() || 'Imported Lorebook';
    return characterDb.createLorebook({
      name,
      description: book.description || '',
      book: {
        ...book,
        name,
        extensions: book.extensions || {},
        entries: book.entries || [],
      },
    });
  }

  async importFromFile(file: File): Promise<VaultLorebook> {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new Error('File is not valid JSON');
    }

    return this.importFromData(data, nameFromLorebookFile(file.name));
  }

  /** Build SillyTavern export blob for a vault lorebook. */
  exportToSTBlob(lorebook: VaultLorebook): { blob: Blob; filename: string } {
    const book = lorebook.book ?? createEmptyCharacterBook(lorebook.name);
    const exportData = convertToSTLorebook({
      ...book,
      name: book.name || lorebook.name,
      description: book.description ?? lorebook.description ?? '',
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const filename = sanitizeFilename(lorebook.name || 'lorebook', '.json');
    return { blob, filename };
  }

  downloadExport(lorebook: VaultLorebook): void {
    const { blob, filename } = this.exportToSTBlob(lorebook);
    let url: string | null = null;
    try {
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  toListItem(lorebook: VaultLorebook): LorebookListItem {
    return toLorebookListItem(lorebook);
  }
}

export const lorebookService = new LorebookService();

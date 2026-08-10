/**
 * Hook for standalone lorebook vault state and operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  CharacterBook,
  CreateVaultLorebookInput,
  LorebookListItem,
  UpdateVaultLorebookInput,
  VaultLorebook,
} from '../db/characterTypes';
import { lorebookService } from '../services/LorebookService';
import { lorebookSnapshotService } from '../services/LorebookSnapshotService';

interface LorebookResult {
  lorebookListItems: LorebookListItem[];
  currentLorebook: VaultLorebook | null;
  isLoading: boolean;
  error: Error | null;
}

interface LorebookOperations {
  createLorebook: (input: CreateVaultLorebookInput) => Promise<VaultLorebook>;
  openLorebook: (id: string) => Promise<void>;
  closeLorebook: () => void;
  deleteLorebook: (id: string) => Promise<void>;
  updateLorebook: (id: string, input: UpdateVaultLorebookInput) => Promise<VaultLorebook>;
  updateLorebookBook: (id: string, book: CharacterBook) => Promise<VaultLorebook>;
  duplicateLorebook: (id: string, newName: string) => Promise<VaultLorebook>;
  refreshLorebooks: () => Promise<void>;
  importLorebookFile: (file: File) => Promise<VaultLorebook>;
  exportLorebook: (id: string) => Promise<void>;
}

export function useLorebook(): [LorebookResult, LorebookOperations] {
  const [lorebookListItems, setLorebookListItems] = useState<LorebookListItem[]>([]);
  const [currentLorebookId, setCurrentLorebookId] = useState<string | null>(null);
  const [currentLorebook, setCurrentLorebook] = useState<VaultLorebook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshLorebooks = useCallback(async () => {
    try {
      const items = await lorebookService.listItems();
      setLorebookListItems(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh lorebooks'));
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        await refreshLorebooks();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load lorebooks'));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [refreshLorebooks]);

  // Keep current lorebook in sync when list id is set
  useEffect(() => {
    if (!currentLorebookId) {
      setCurrentLorebook(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const book = await lorebookService.get(currentLorebookId);
      if (!cancelled) {
        setCurrentLorebook(book ?? null);
        if (!book) setCurrentLorebookId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentLorebookId]);

  const createLorebook = useCallback(async (input: CreateVaultLorebookInput) => {
    const created = await lorebookService.create(input);
    await refreshLorebooks();
    setCurrentLorebookId(created.id);
    setCurrentLorebook(created);
    await lorebookSnapshotService.createFromLorebook(created, 'open');
    return created;
  }, [refreshLorebooks]);

  const openLorebook = useCallback(async (id: string) => {
    const book = await lorebookService.get(id);
    if (!book) {
      throw new Error('Lorebook not found');
    }
    await lorebookService.markOpened(id);
    setCurrentLorebookId(id);
    setCurrentLorebook(book);
    await lorebookSnapshotService.createFromLorebook(book, 'open');
    await refreshLorebooks();
  }, [refreshLorebooks]);

  const closeLorebook = useCallback(() => {
    setCurrentLorebookId(null);
    setCurrentLorebook(null);
  }, []);

  const deleteLorebook = useCallback(async (id: string) => {
    await lorebookService.delete(id);
    if (currentLorebookId === id) {
      setCurrentLorebookId(null);
      setCurrentLorebook(null);
    }
    await refreshLorebooks();
  }, [currentLorebookId, refreshLorebooks]);

  const updateLorebook = useCallback(async (id: string, input: UpdateVaultLorebookInput) => {
    const updated = await lorebookService.update(id, input);
    if (currentLorebookId === id) {
      setCurrentLorebook(updated);
    }
    await refreshLorebooks();
    return updated;
  }, [currentLorebookId, refreshLorebooks]);

  const updateLorebookBook = useCallback(async (id: string, book: CharacterBook) => {
    const updated = await lorebookService.updateBook(id, book);
    if (currentLorebookId === id) {
      setCurrentLorebook(updated);
    }
    await refreshLorebooks();
    return updated;
  }, [currentLorebookId, refreshLorebooks]);

  const duplicateLorebook = useCallback(async (id: string, newName: string) => {
    const duplicated = await lorebookService.duplicate(id, newName);
    await refreshLorebooks();
    return duplicated;
  }, [refreshLorebooks]);

  const importLorebookFile = useCallback(async (file: File) => {
    const imported = await lorebookService.importFromFile(file);
    await refreshLorebooks();
    return imported;
  }, [refreshLorebooks]);

  const exportLorebook = useCallback(async (id: string) => {
    const book = await lorebookService.get(id);
    if (!book) throw new Error('Lorebook not found');
    lorebookService.downloadExport(book);
  }, []);

  const result = useMemo<LorebookResult>(
    () => ({
      lorebookListItems,
      currentLorebook,
      isLoading,
      error,
    }),
    [lorebookListItems, currentLorebook, isLoading, error],
  );

  const operations: LorebookOperations = {
    createLorebook,
    openLorebook,
    closeLorebook,
    deleteLorebook,
    updateLorebook,
    updateLorebookBook,
    duplicateLorebook,
    refreshLorebooks,
    importLorebookFile,
    exportLorebook,
  };

  return [result, operations];
}

/**
 * Global standalone lorebook vault state.
 */

import React, { createContext, type ReactNode } from 'react';
import { useLorebook } from '../hooks/useLorebook';
import type {
  CharacterBook,
  CreateVaultLorebookInput,
  LorebookListItem,
  UpdateVaultLorebookInput,
  VaultLorebook,
} from '../db/characterTypes';

interface LorebookContextValue {
  currentLorebook: VaultLorebook | null;
  isLorebookOpen: boolean;
  lorebookListItems: LorebookListItem[];
  isLoading: boolean;
  error: Error | null;
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

const LorebookContext = createContext<LorebookContextValue | null>(null);

export function LorebookProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [result, operations] = useLorebook();

  const value: LorebookContextValue = {
    currentLorebook: result.currentLorebook,
    isLorebookOpen: result.currentLorebook !== null,
    lorebookListItems: result.lorebookListItems,
    isLoading: result.isLoading,
    error: result.error,
    createLorebook: operations.createLorebook,
    openLorebook: operations.openLorebook,
    closeLorebook: operations.closeLorebook,
    deleteLorebook: operations.deleteLorebook,
    updateLorebook: operations.updateLorebook,
    updateLorebookBook: operations.updateLorebookBook,
    duplicateLorebook: operations.duplicateLorebook,
    refreshLorebooks: operations.refreshLorebooks,
    importLorebookFile: operations.importLorebookFile,
    exportLorebook: operations.exportLorebook,
  };

  return <LorebookContext.Provider value={value}>{children}</LorebookContext.Provider>;
}

export { LorebookContext };

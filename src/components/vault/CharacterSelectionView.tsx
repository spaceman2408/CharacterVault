import React, { useState } from 'react';
import { Book, Upload, User, X } from 'lucide-react';
import { useCharacterContext, useLorebookContext } from '../../context';
import { PromoBanner } from '../PromoBanner';
import type { ConfirmTarget, VaultTab } from './types';
import { useVaultLibrary } from './useVaultLibrary';
import { useVaultIO } from './useVaultIO';
import { VaultHeader } from './VaultHeader';
import { VaultToolbar } from './VaultToolbar';
import { VaultGrid } from './VaultGrid';
import { VaultModals } from './VaultModals';
import { LorebookVaultView } from './LorebookVaultView';

const VAULT_TAB_KEY = 'characterVaultActiveTab';

export function CharacterSelectionView({
  onReplayTutorial,
}: {
  onReplayTutorial: () => void;
}): React.ReactElement {
  const {
    characterListItems,
    isLoading,
    createCharacter,
    openCharacter,
    deleteCharacter,
    duplicateCharacter,
    refreshCharacters,
  } = useCharacterContext();
  const { lorebookListItems, createLorebook, importLorebookFile } = useLorebookContext();

  const handleOpenCharacter = async (id: string) => {
    // openCharacter drops any open lorebook payload (exclusive workspace)
    await openCharacter(id);
  };

  const [vaultTab, setVaultTab] = useState<VaultTab>(() => {
    try {
      const stored = localStorage.getItem(VAULT_TAB_KEY);
      return stored === 'lorebooks' ? 'lorebooks' : 'characters';
    } catch {
      return 'characters';
    }
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [lorebookSearch, setLorebookSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<ConfirmTarget | null>(null);
  const [copyConfirm, setCopyConfirm] = useState<ConfirmTarget | null>(null);

  const selectTab = (tab: VaultTab) => {
    setVaultTab(tab);
    setIsCreating(false);
    setNewItemName('');
    try {
      localStorage.setItem(VAULT_TAB_KEY, tab);
    } catch {
      // ignore
    }
  };

  const [isPromoDismissed, setIsPromoDismissed] = useState(() => {
    return localStorage.getItem('characterVaultPromoDismissed') === 'true';
  });

  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  });

  const library = useVaultLibrary(characterListItems);
  const io = useVaultIO({
    characterCount: characterListItems.length,
    lorebookCount: lorebookListItems.length,
    vaultTab,
    refreshCharacters,
    importLorebookFile,
  });

  const handlePromoDismiss = () => {
    localStorage.setItem('characterVaultPromoDismissed', 'true');
    setIsPromoDismissed(true);
  };

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItemName.trim();
    if (!name) return;
    try {
      if (vaultTab === 'lorebooks') {
        await createLorebook({ name });
        setNewItemName('');
        setIsCreating(false);
        return;
      }
      await createCharacter({ name });
      setNewItemName('');
      setIsCreating(false);
    } catch {
      alert(vaultTab === 'lorebooks' ? 'Failed to create lorebook' : 'Failed to create character');
    }
  };

  const isLorebooksTab = vaultTab === 'lorebooks';

  return (
    <div
      className="h-dvh overflow-y-auto bg-bg text-fg transition-colors duration-500 animate-fade-in-slow relative"
      onDragEnter={io.handleDragEnter}
      onDragLeave={io.handleDragLeave}
      onDragOver={io.handleDragOver}
      onDrop={io.handleDrop}
    >
      {io.isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-accent/50 bg-surface/90 px-10 py-8 text-center shadow-2xl">
            <Upload className="mx-auto mb-3 h-10 w-10 text-accent opacity-90" />
            <p className="text-lg font-semibold text-fg">
              {isLorebooksTab ? 'Drop lorebooks to import' : 'Drop character cards to import'}
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              {isLorebooksTab ? 'JSON — multiple files supported' : 'PNG or JSON — multiple files supported'}
            </p>
          </div>
        </div>
      )}

      {io.statusMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-2 rounded-xl border border-border bg-surface/95 px-4 py-3 text-sm shadow-xl">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-fg">{io.statusMessage}</p>
            <button
              type="button"
              onClick={() => io.setStatusMessage(null)}
              className="rounded p-0.5 text-fg-subtle hover:bg-accent-soft hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <VaultHeader
        searchQuery={isLorebooksTab ? lorebookSearch : library.searchQuery}
        onSearchChange={isLorebooksTab ? setLorebookSearch : library.setSearchQuery}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onReplayTutorial={onReplayTutorial}
        onImportClick={io.openFilePicker}
        onBackupClick={io.handleBackupClick}
        onCreateClick={() => setIsCreating(true)}
        isImporting={io.isImporting}
        isExportingVault={io.isExportingVault}
        canBackup={io.canBackup}
        fileInputRef={io.fileInputRef}
        onImportChange={io.handleImport}
        searchPlaceholder={isLorebooksTab ? 'Search lorebooks...' : 'Search name or tags...'}
        importAccept={
          isLorebooksTab ? '.json,application/json' : '.png,.json,image/png,application/json'
        }
        importTitle={isLorebooksTab ? 'Import lorebook JSON' : 'Import character cards'}
        createLabel={isLorebooksTab ? 'New Lorebook' : 'Create'}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => selectTab('characters')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                vaultTab === 'characters'
                  ? 'bg-accent-soft text-accent'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              <User className="h-4 w-4" />
              Characters
              <span className="text-xs opacity-70">{characterListItems.length}</span>
            </button>
            <button
              type="button"
              onClick={() => selectTab('lorebooks')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                vaultTab === 'lorebooks'
                  ? 'bg-accent-soft text-accent'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Book className="h-4 w-4" />
              Lorebooks
              <span className="text-xs opacity-70">{lorebookListItems.length}</span>
            </button>
          </div>
        </div>

        <VaultModals
          isCreating={isCreating}
          newCharacterName={newItemName}
          onNewCharacterNameChange={setNewItemName}
          onCreateSubmit={handleCreate}
          onCreateCancel={() => {
            setIsCreating(false);
            setNewItemName('');
          }}
          createPlaceholder={isLorebooksTab ? 'Lorebook name...' : 'Character name...'}
          deleteConfirm={deleteConfirm}
          onDeleteConfirm={async () => {
            if (deleteConfirm) {
              await deleteCharacter(deleteConfirm.id);
              setDeleteConfirm(null);
            }
          }}
          onDeleteCancel={() => setDeleteConfirm(null)}
          copyConfirm={copyConfirm}
          onCopyConfirm={async () => {
            if (copyConfirm) {
              await duplicateCharacter(copyConfirm.id, `${copyConfirm.name} (Copy)`);
              setCopyConfirm(null);
            }
          }}
          onCopyCancel={() => setCopyConfirm(null)}
          backupConfirmOpen={io.backupConfirmOpen}
          isExportingVault={io.isExportingVault}
          onBackupConfirm={() => void io.handleExportVault()}
          onBackupCancel={io.handleBackupCancel}
        />

        {vaultTab === 'characters' ? (
          <>
            <div className="mb-6 flex items-start gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-xs text-fg-muted sm:items-center">
              <svg
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle sm:mt-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              <span>
                Thumbnails appear blurry to save memory. Your full images are preserved in the card when
                you export.
              </span>
            </div>

            <VaultToolbar
              totalCount={characterListItems.length}
              filteredCount={library.sortedCharacters.length}
              searchQuery={library.searchQuery}
              sortMode={library.sortMode}
              onSortChange={library.handleSortChange}
              lastActive={library.lastActive}
              onContinue={(id) => void handleOpenCharacter(id)}
            />

            {!isPromoDismissed && !isLoading && (
              <>
                <div className="hidden lg:block fixed left-4 xl:left-6 top-36 z-40 w-56 xl:w-64">
                  <div className="sticky top-36">
                    <PromoBanner onDismiss={handlePromoDismiss} />
                  </div>
                </div>
                <div className="lg:hidden mb-6">
                  <PromoBanner onDismiss={handlePromoDismiss} />
                </div>
              </>
            )}

            <VaultGrid
              isLoading={isLoading}
              pageSize={library.pageSize}
              sortedCharacters={library.sortedCharacters}
              visibleCharacters={library.visibleCharacters}
              searchQuery={library.searchQuery}
              safeCurrentPage={library.safeCurrentPage}
              totalPages={library.totalPages}
              onPageChange={library.setCurrentPage}
              onOpen={(id) => void handleOpenCharacter(id)}
              onDuplicate={(id, name) => setCopyConfirm({ id, name })}
              onDelete={(id, name) => setDeleteConfirm({ id, name })}
              onExport={io.handleCardExport}
              exportingCardId={io.exportingCardId}
              onImportClick={io.openFilePicker}
            />
          </>
        ) : (
          <LorebookVaultView
            searchQuery={lorebookSearch}
            onRequestCreate={() => setIsCreating(true)}
          />
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-2">
        <nav
          aria-label="Site"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-fg-subtle"
        >
          <a
            href={`${import.meta.env.BASE_URL}docs/privacy`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            Privacy
          </a>
          <span className="text-border" aria-hidden="true">
            ·
          </span>
          <a
            href={`${import.meta.env.BASE_URL}docs/`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            Docs
          </a>
          <span className="text-border" aria-hidden="true">
            ·
          </span>
          <a
            href="https://github.com/spaceman2408/CharacterVault"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            GitHub
          </a>
          <span className="text-border" aria-hidden="true">
            ·
          </span>
          <a
            href="https://github.com/spaceman2408/CharacterVault/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            GPL-3.0
          </a>
        </nav>
      </footer>
    </div>
  );
}

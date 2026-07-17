import { useEffect, useMemo, useState } from 'react';
import type { CharacterListItem } from '../../db';
import type { VaultSortMode } from './types';
import { VAULT_SORT_STORAGE_KEY } from './types';
import { getVaultPageSize } from './utils';

export function useVaultLibrary(characterListItems: CharacterListItem[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<VaultSortMode>(() => {
    const stored = localStorage.getItem(VAULT_SORT_STORAGE_KEY);
    return stored === 'recent' || stored === 'name' ? stored : 'name';
  });
  const [pageSize, setPageSize] = useState(getVaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, sortMode]);

  useEffect(() => {
    const handleResize = () => {
      setPageSize(getVaultPageSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSortChange = (mode: VaultSortMode) => {
    setSortMode(mode);
    localStorage.setItem(VAULT_SORT_STORAGE_KEY, mode);
  };

  const filteredCharacters = useMemo(() => {
    let result = [...characterListItems];
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        return (c.tags ?? []).some((tag) => tag.toLowerCase().includes(q));
      });
    }
    return result;
  }, [characterListItems, searchQuery]);

  const sortedCharacters = useMemo(() => {
    const list = [...filteredCharacters];
    if (sortMode === 'recent') {
      return list.sort((a, b) => {
        const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
        const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    }
    return list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    );
  }, [filteredCharacters, sortMode]);

  const lastActive = useMemo(() => {
    return [...characterListItems].sort((a, b) => {
      const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return b.updatedAt.localeCompare(a.updatedAt);
    })[0];
  }, [characterListItems]);

  const totalPages = Math.max(1, Math.ceil(sortedCharacters.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;

  const visibleCharacters = useMemo(
    () => sortedCharacters.slice(pageStart, pageStart + pageSize),
    [sortedCharacters, pageStart, pageSize]
  );

  return {
    searchQuery,
    setSearchQuery,
    sortMode,
    handleSortChange,
    sortedCharacters,
    visibleCharacters,
    lastActive,
    totalPages,
    safeCurrentPage,
    setCurrentPage,
    pageSize,
  };
}

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [areVisibleCardsReady, setAreVisibleCardsReady] = useState(false);
  const preloadedThumbIdsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    let isCancelled = false;

    const preloadVisibleCards = async () => {
      const visibleIds = new Set(visibleCharacters.map((c) => c.id));
      for (const id of preloadedThumbIdsRef.current) {
        if (!visibleIds.has(id)) {
          preloadedThumbIdsRef.current.delete(id);
        }
      }

      const imagesToPreload = visibleCharacters
        .filter((character) => {
          if (!character.thumbnailData) return false;
          return !preloadedThumbIdsRef.current.has(character.id);
        })
        .map(
          (character) =>
            new Promise<void>((resolve) => {
              const image = new Image();
              const imageSource = character.thumbnailData;
              let settled = false;

              const finalize = () => {
                if (settled) return;
                settled = true;
                preloadedThumbIdsRef.current.add(character.id);
                image.onload = null;
                image.onerror = null;
                image.src = '';
                resolve();
              };

              image.onload = finalize;
              image.onerror = finalize;
              image.src = imageSource;

              if (image.complete) {
                finalize();
                return;
              }

              if (typeof image.decode === 'function') {
                image.decode().then(finalize).catch(finalize);
              }
            })
        );

      if (imagesToPreload.length === 0) {
        if (!isCancelled) {
          setAreVisibleCardsReady(true);
        }
        return;
      }

      setAreVisibleCardsReady(false);
      await Promise.all(imagesToPreload);

      if (!isCancelled) {
        requestAnimationFrame(() => {
          if (!isCancelled) {
            setAreVisibleCardsReady(true);
          }
        });
      }
    };

    void preloadVisibleCards();

    return () => {
      isCancelled = true;
    };
  }, [visibleCharacters]);

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
    areVisibleCardsReady,
  };
}

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Copy,
  Download,
  FileJson,
  Image as ImageIcon,
  ImageOff,
  Info,
  Loader2,
  Pencil,
  Trash2,
  User,
} from 'lucide-react';
import { formatTokenEstimate } from '../../services/AIService';
import type { CharacterListItem } from '../../db';
import type { CardExportFormat } from './types';
import { formatRelativeTime } from './utils';
import { CharacterCardDetailsSheet } from './CharacterCardDetailsSheet';

const TAG_CHIP_LIMIT = 3;

const cardActionBtnBase =
  'inline-flex items-center justify-center min-h-9 min-w-9 sm:min-h-8 sm:min-w-8 p-2 sm:p-1.5 ' +
  'bg-surface/95 backdrop-blur-sm rounded-lg shadow-sm ' +
  'active:scale-95 transition-colors disabled:opacity-50 touch-manipulation';

const cardActionBtnClass =
  `${cardActionBtnBase} text-fg-muted hover:bg-accent-soft hover:text-accent`;

const cardActionBtnDangerClass =
  `${cardActionBtnBase} text-fg-muted hover:bg-danger-soft hover:text-danger`;

export interface CharacterCardProps {
  character: CharacterListItem;
  onOpen: (id: string) => void;
  onDuplicate: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onExport: (id: string, format: CardExportFormat) => Promise<void>;
  isExporting?: boolean;
}

export function CharacterCard({
  character,
  onOpen,
  onDuplicate,
  onDelete,
  onExport,
  isExporting = false,
}: CharacterCardProps): React.ReactElement {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const hasImage = Boolean(character.thumbnailData);
  const tags = character.tags ?? [];
  const visibleTags = tags.slice(0, TAG_CHIP_LIMIT);
  const overflowTagCount = Math.max(0, tags.length - TAG_CHIP_LIMIT);

  const openDetails = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDetailsOpen(true);
  };

  const openExportMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExporting) return;
    if (!exportBtnRef.current) return;

    const rect = exportBtnRef.current.getBoundingClientRect();
    const menuWidth = 168;
    const menuHeight = 96;
    const pad = 8;

    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - menuHeight - 6);
    }
    let left = rect.right - menuWidth;
    if (left < pad) left = pad;
    if (left + menuWidth > window.innerWidth - pad) {
      left = window.innerWidth - menuWidth - pad;
    }

    setMenuPosition({ top, left });
    setExportMenuOpen(true);
  };

  useEffect(() => {
    if (!exportMenuOpen) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        exportBtnRef.current?.contains(target) ||
        exportMenuRef.current?.contains(target)
      ) {
        return;
      }
      setExportMenuOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportMenuOpen(false);
    };

    const handleViewportChange = () => setExportMenuOpen(false);

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [exportMenuOpen]);

  const handleExport = async (format: CardExportFormat) => {
    setExportMenuOpen(false);
    await onExport(character.id, format);
  };

  return (
    <div
      className="group relative flex flex-col bg-surface rounded-2xl border border-border hover:border-accent/40 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={() => onOpen(character.id)}
    >
      <div className="relative aspect-3/4 w-full overflow-hidden bg-muted">
        {hasImage ? (
          <img
            src={character.thumbnailData}
            alt={character.name}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            decoding="async"
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-2 text-fg-subtle">
            <User className="w-14 h-14 sm:w-16 sm:h-16 opacity-60" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-surface/80 border border-border text-fg-muted">
              <ImageOff className="w-3 h-3" />
              No image
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-linear-to-t from-vault-950/60 via-transparent to-vault-950/15 sm:from-vault-950/70 sm:to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300" />

        {!hasImage && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-surface/90 backdrop-blur-sm border border-border text-fg-muted shadow-sm">
              <ImageOff className="w-3 h-3" />
              No art
            </span>
          </div>
        )}

        <div
          className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-row gap-1 transition-all duration-200 opacity-100 translate-y-0 sm:opacity-0 sm:-translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 sm:group-focus-within:opacity-100 sm:group-focus-within:translate-y-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={openDetails}
            className={cardActionBtnClass}
            title="Card details"
            aria-label={`Details for ${character.name}`}
          >
            <Info className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
          <button
            ref={exportBtnRef}
            type="button"
            onClick={openExportMenu}
            disabled={isExporting}
            className={cardActionBtnClass}
            title="Export"
            aria-label={`Export ${character.name}`}
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(character.id, character.name);
            }}
            className={cardActionBtnClass}
            title="Duplicate"
            aria-label={`Duplicate ${character.name}`}
          >
            <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(character.id, character.name);
            }}
            className={cardActionBtnDangerClass}
            title="Delete"
            aria-label={`Delete ${character.name}`}
          >
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile: image + name only. Desktop: full metadata (tags, activity, tokens). */}
      <div className="flex flex-col gap-0 p-2.5 sm:gap-2.5 sm:p-4 flex-1">
        <h3 className="font-semibold text-fg text-sm sm:text-[15px] leading-snug line-clamp-1 sm:line-clamp-2">
          {character.name}
        </h3>

        <div className="hidden sm:flex flex-col gap-2.5 flex-1">
          {(visibleTags.length > 0 || overflowTagCount > 0) ? (
            <button
              type="button"
              onClick={openDetails}
              className="flex flex-wrap gap-1 text-left rounded-lg -mx-0.5 px-0.5 py-0.5 hover:bg-accent-soft/40 active:bg-accent-soft/60 transition-colors touch-manipulation"
              aria-label={`Show all tags for ${character.name}`}
            >
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex max-w-full items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-accent-soft text-accent border border-accent/25 truncate"
                >
                  {tag}
                </span>
              ))}
              {overflowTagCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-fg-muted border border-border">
                  +{overflowTagCount}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={openDetails}
              className="text-left text-[11px] text-fg-subtle italic hover:text-accent transition-colors touch-manipulation"
            >
              No tags · click for details
            </button>
          )}

          <button
            type="button"
            onClick={openDetails}
            className="flex flex-col gap-1 text-[11px] text-fg-muted mt-auto text-left rounded-lg -mx-0.5 px-0.5 py-0.5 hover:bg-accent-soft/40 active:bg-accent-soft/60 transition-colors touch-manipulation"
            aria-label={`Show activity for ${character.name}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock className="w-3 h-3 shrink-0 text-fg-subtle" />
              <span className="truncate">
                Opened {formatRelativeTime(character.lastOpenedAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Pencil className="w-3 h-3 shrink-0 text-fg-subtle" />
              <span className="truncate">
                Edited {formatRelativeTime(character.updatedAt)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={openDetails}
            className="inline-flex self-start items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold tabular-nums bg-muted text-fg border border-border hover:border-accent/40 hover:bg-accent-soft active:scale-[0.98] transition-all touch-manipulation"
            aria-label={`Show token details for ${character.name}`}
            title="Click for token breakdown"
          >
            <span className="text-accent">{formatTokenEstimate(character.activeTokens)}</span>
            <span className="text-fg-subtle font-normal">/</span>
            <span className="text-fg-muted">{formatTokenEstimate(character.totalTokens)}</span>
            <span className="text-fg-subtle font-medium normal-case tracking-normal">tok</span>
          </button>
        </div>
      </div>

      {exportMenuOpen && menuPosition && createPortal(
        <div
          ref={exportMenuRef}
          role="menu"
          aria-label={`Export ${character.name}`}
          className="fixed z-9999 w-44 rounded-xl border border-border bg-surface shadow-xl py-1 animate-in fade-in zoom-in-95"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-fg hover:bg-accent-soft hover:text-accent active:bg-hover touch-manipulation"
            onClick={() => void handleExport('png')}
          >
            <ImageIcon className="w-4 h-4 shrink-0 text-fg-muted" />
            <span>Export PNG</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-fg hover:bg-accent-soft hover:text-accent active:bg-hover touch-manipulation"
            onClick={() => void handleExport('json')}
          >
            <FileJson className="w-4 h-4 shrink-0 text-fg-muted" />
            <span>Export JSON</span>
          </button>
        </div>,
        document.body
      )}

      {detailsOpen && (
        <CharacterCardDetailsSheet
          character={character}
          onClose={() => setDetailsOpen(false)}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

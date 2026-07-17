/**
 * @fileoverview Character section tab visibility & order settings.
 * @module components/settings/tabs/SectionsTab
 */

import React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid, RotateCcw } from 'lucide-react';
import {
  CHARACTER_SECTIONS,
  DEFAULT_SECTION_ORDER,
  type CharacterSection,
} from '../../../db/characterTypes';
import { SettingsCard } from '../components/SettingsCard';
import type { SettingsTabProps } from '../types';

export const SectionsTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  const { sectionOrder: localSectionOrder, hiddenSections: localHiddenSections } = draft;

  const setLocalSectionOrder = (next: CharacterSection[] | ((prev: CharacterSection[]) => CharacterSection[])) => {
    setDraft((prev) => ({
      ...prev,
      sectionOrder: typeof next === 'function' ? next(prev.sectionOrder) : next,
    }));
  };

  const setLocalHiddenSections = (
    next: CharacterSection[] | ((prev: CharacterSection[]) => CharacterSection[])
  ) => {
    setDraft((prev) => ({
      ...prev,
      hiddenSections: typeof next === 'function' ? next(prev.hiddenSections) : next,
    }));
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-2">
          <LayoutGrid className="w-4 h-4" />
          Tab Visibility &amp; Order
        </h3>
        <p className="text-xs text-fg-muted mb-4 leading-relaxed">
          Toggle sections on/off to hide them from the tab strip. Use the arrows to reorder. Hidden
          sections appear below the divider.
        </p>

        <button
          onClick={() => {
            setLocalSectionOrder([...DEFAULT_SECTION_ORDER]);
            setLocalHiddenSections([]);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-hover rounded-lg transition-colors mb-4 focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </button>

        <div className="space-y-1">
          {(() => {
            const visibleIds = localSectionOrder.filter((id) => !localHiddenSections.includes(id));
            return visibleIds.map((sectionId, visIdx) => {
              const meta = CHARACTER_SECTIONS.find((s) => s.id === sectionId);
              if (!meta) return null;
              const realIdx = localSectionOrder.indexOf(sectionId);
              const prevRealIdx =
                visIdx > 0 ? localSectionOrder.indexOf(visibleIds[visIdx - 1]) : -1;
              const nextRealIdx =
                visIdx < visibleIds.length - 1
                  ? localSectionOrder.indexOf(visibleIds[visIdx + 1])
                  : -1;
              return (
                <div
                  key={sectionId}
                  className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-hover/50 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => {
                        if (prevRealIdx < 0) return;
                        const next = [...localSectionOrder];
                        [next[realIdx], next[prevRealIdx]] = [next[prevRealIdx], next[realIdx]];
                        setLocalSectionOrder(next);
                      }}
                      disabled={visIdx === 0}
                      className="p-0.5 text-fg-subtle hover:text-fg disabled:opacity-25 disabled:cursor-default transition-colors"
                      aria-label={`Move ${meta.label} up`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (nextRealIdx < 0) return;
                        const next = [...localSectionOrder];
                        [next[realIdx], next[nextRealIdx]] = [next[nextRealIdx], next[realIdx]];
                        setLocalSectionOrder(next);
                      }}
                      disabled={visIdx >= visibleIds.length - 1}
                      className="p-0.5 text-fg-subtle hover:text-fg disabled:opacity-25 disabled:cursor-default transition-colors"
                      aria-label={`Move ${meta.label} down`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="flex-1 text-sm font-medium text-fg truncate">
                    {meta.label}
                  </span>
                  <span className="text-xs text-fg-subtle truncate max-w-30 sm:max-w-50">
                    {meta.description}
                  </span>

                  <button
                    onClick={() => {
                      setLocalHiddenSections((prev) => [...prev, sectionId]);
                    }}
                    className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-hover transition-colors shrink-0"
                    aria-label={`Hide ${meta.label}`}
                    title="Hide tab"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              );
            });
          })()}
        </div>

        {localHiddenSections.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-4 mb-2 px-2">
              <div className="flex-1 h-px bg-hover" />
              <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">
                Hidden
              </span>
              <div className="flex-1 h-px bg-hover" />
            </div>
            <div className="space-y-1">
              {localSectionOrder
                .filter((id) => localHiddenSections.includes(id))
                .map((sectionId) => {
                  const meta = CHARACTER_SECTIONS.find((s) => s.id === sectionId);
                  if (!meta) return null;
                  return (
                    <div
                      key={sectionId}
                      className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-hover/50 transition-colors opacity-60"
                    >
                      <span className="flex-1 text-sm font-medium text-fg-muted truncate">
                        {meta.label}
                      </span>
                      <span className="text-xs text-fg-subtle truncate max-w-30 sm:max-w-50">
                        {meta.description}
                      </span>
                      <button
                        onClick={() => {
                          setLocalHiddenSections((prev) => prev.filter((id) => id !== sectionId));
                        }}
                        className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-hover transition-colors shrink-0"
                        aria-label={`Show ${meta.label}`}
                        title="Show tab"
                      >
                        <EyeOff className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </SettingsCard>
    </div>
  );
};

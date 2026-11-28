import React from 'react';
import { TagChip } from './TagChip';
import type { TaggedRef } from './tags/tagData';
import {
  formatTag,
  getGenerationTags,
  PERSPECTIVE_TAGS,
  TENSE_TAGS,
  toggleGenerationTagSelection,
} from './tags/tagData';

const STYLE_DEFAULT_TITLES = { add: 'Select by default', remove: 'Stop selecting by default' };

interface GenerationStyleProps {
  selections: Record<string, string[]>;
  onSelectionsChange: (s: Record<string, string[]>) => void;
  isGenerating: boolean;
  favorites: TaggedRef[];
  onToggleFavorite: (category: string, tag: string) => void;
}

export const RequiredBadge: React.FC = () => (
  <span className="font-bold px-1.5 py-0.5 rounded-full bg-warning-soft text-warning-soft-fg">
    Required
  </span>
);

export const GenerationStyleOptions: React.FC<GenerationStyleProps> = ({
  selections,
  onSelectionsChange,
  isGenerating,
  favorites,
  onToggleFavorite,
}) => {
  const generationSelections = selections.generation ?? [];
  const generationTags = getGenerationTags(selections);

  const renderChip = (tag: string) => (
    <TagChip
      key={tag}
      label={formatTag(tag)}
      selected={generationSelections.includes(tag)}
      favorite={favorites.some((f) => f.category === 'generation' && f.tag === tag)}
      onToggle={() =>
        onSelectionsChange({
          ...selections,
          generation: toggleGenerationTagSelection(generationSelections, tag),
        })
      }
      onToggleFavorite={() => onToggleFavorite('generation', tag)}
      disabled={isGenerating}
      favoriteTitles={STYLE_DEFAULT_TITLES}
    />
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="font-medium text-fg-muted mb-1.5">Perspective</p>
        <div className="flex flex-wrap gap-1.5">{PERSPECTIVE_TAGS.map(renderChip)}</div>
      </div>
      <div>
        <p className="font-medium text-fg-muted mb-1.5">Tense</p>
        <div className="flex flex-wrap gap-1.5">{TENSE_TAGS.map(renderChip)}</div>
      </div>
      {(!generationTags.perspective || !generationTags.tense) && (
        <p className="text-xs text-warning">Choose one perspective and one tense before generating.</p>
      )}
    </div>
  );
};

export const GenerationStyleSelector: React.FC<GenerationStyleProps> = (props) => (
  <div className="space-y-3 p-4 bg-bg/50 border border-border rounded-xl">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
        Generation Style
      </span>
      <RequiredBadge />
    </div>
    <GenerationStyleOptions {...props} />
  </div>
);

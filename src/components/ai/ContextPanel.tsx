/**
 * @fileoverview Context Panel component for adding character sections as AI context.
 * Updated for CharacterVault - Docked side panel version with collapsible sections.
 * @module components/ai/ContextPanel
 */

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Trash2,
  Sparkles,
  X,
  AlertCircle,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCharacterEditorContext } from '../../context';
import { CHARACTER_SECTIONS } from '../../db/characterTypes';

export interface ContextPanelProps {
  /** Callback to close panel (for mobile) */
  onClose?: () => void;
  /** Whether this is mobile view (shows close button) */
  isMobile?: boolean;
}

/**
 * Context Panel component - Docked side panel with collapsible sections
 * 
 * Features:
 * - Docked to the left side of the workspace
 * - Collapsible sections for Selected Context and Add Context
 * - Mobile responsive with close button
 */
export function ContextPanel({
  onClose,
  isMobile = false,
}: ContextPanelProps): React.ReactElement {
  const { 
    currentCharacter, 
    contextSectionIds, 
    setContextSectionIds, 
    addContextSection, 
    removeContextSection,
    samplerSettings,
  } = useCharacterEditorContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Collapsible section states
  const [isSelectedContextExpanded, setIsSelectedContextExpanded] = useState(true);
  const [isAddContextExpanded, setIsAddContextExpanded] = useState(true);
  
  // Context limit from sampler settings
  const contextLimit = samplerSettings.contextLength;

  // Filter sections based on search query
  const filteredSections = CHARACTER_SECTIONS.filter(section => {
    // Exclude image, extensions, and certain v3 fields (not useful for context)
    const excludedSections = ['image', 'extensions', 'avatar', 'character_version', 'tags'];
    if (excludedSections.includes(section.id)) return false;
    
    // Exclude already selected sections
    if (contextSectionIds.includes(section.id)) return false;
    
    // Hide lorebook if character has no lorebook or it's empty
    if (section.id === 'lorebook') {
      const hasLorebook = currentCharacter?.data.characterBook && 
                         currentCharacter.data.characterBook.entries.length > 0;
      if (!hasLorebook) return false;
    }
    
    // Filter by search query
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      section.label.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query)
    );
  });

  // Get selected context sections
  const contextSections = CHARACTER_SECTIONS.filter(
    section => contextSectionIds.includes(section.id)
  );

  // Calculate approximate token count (1 token ≈ 4 characters)
  const calculateTokenCount = useCallback((): number => {
    if (!currentCharacter) return 0;
    
    let totalChars = 0;
    contextSectionIds.forEach(sectionId => {
      const spec = currentCharacter.data.spec;
      switch (sectionId) {
        case 'name':
          totalChars += spec.name.length;
          break;
        case 'description':
          totalChars += spec.description.length;
          break;
        case 'personality':
          totalChars += spec.personality.length;
          break;
        case 'scenario':
          totalChars += spec.scenario.length;
          break;
        case 'first_mes':
          totalChars += spec.first_mes.length;
          break;
        case 'mes_example':
          totalChars += spec.mes_example.length;
          break;
        case 'system_prompt':
          totalChars += spec.system_prompt.length;
          break;
        case 'post_history_instructions':
          totalChars += spec.post_history_instructions.length;
          break;
        case 'alternate_greetings':
          totalChars += spec.alternate_greetings.join('\n---\n').length;
          break;
        case 'physical_description':
          totalChars += spec.physical_description.length;
          break;
        case 'creator':
          totalChars += spec.creator?.length || 0;
          break;
        case 'creator_notes':
          totalChars += spec.creator_notes?.length || 0;
          break;
        case 'lorebook': {
          const book = currentCharacter.data.characterBook;
          if (book) {
            totalChars += (book.name?.length || 0);
            totalChars += (book.description?.length || 0);
            book.entries.forEach(entry => {
              if (entry.enabled) {
                totalChars += entry.content.length;
                totalChars += entry.keys.join(',').length;
                totalChars += (entry.name?.length || 0);
                totalChars += (entry.comment?.length || 0);
              }
            });
          }
          break;
        }
      }
    });
    
    return Math.ceil(totalChars / 4);
  }, [currentCharacter, contextSectionIds]);

  // Get usage data for the progress bar
  const usageData = React.useMemo(() => {
    const tokenCount = calculateTokenCount();
    const percentage = Math.min(100, (tokenCount / contextLimit) * 100);
    
    let status: 'good' | 'warning' | 'danger' = 'good';
    if (percentage > 80) {
      status = 'danger';
    } else if (percentage > 50) {
      status = 'warning';
    }
    
    return {
      tokenCount,
      percentage,
      status,
    };
  }, [calculateTokenCount, contextLimit]);

  if (!currentCharacter) return <></>;

  return (
    <div className="h-full flex flex-col bg-vault-50 dark:bg-vault-900 border-r border-vault-200 dark:border-vault-800 animate-fade-in-slow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vault-200 dark:border-vault-800 bg-vault-100 dark:bg-vault-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <h2 className="font-semibold text-vault-900 dark:text-vault-100">
            AI Context
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setContextSectionIds([])}
            className="p-1.5 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-lg transition-colors disabled:opacity-50"
            title="Clear all context"
            disabled={contextSectionIds.length === 0}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-lg transition-colors"
              title="Close Context Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Context Section - Collapsible */}
      <div className="border-b border-vault-200 dark:border-vault-800 shrink-0">
        <button
          onClick={() => setIsSelectedContextExpanded(!isSelectedContextExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-vault-100 dark:hover:bg-vault-800/50 transition-colors"
        >
          <h3 className="text-xs font-medium text-vault-500 dark:text-vault-400 uppercase tracking-wide">
            Selected Context ({contextSections.length})
          </h3>
          {isSelectedContextExpanded ? (
            <ChevronUp className="w-4 h-4 text-vault-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-vault-400" />
          )}
        </button>
        
        {isSelectedContextExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* Context Usage Indicator */}
            {contextSections.length > 0 && (
              <div className="p-3 bg-white dark:bg-vault-800 rounded-lg border border-vault-200 dark:border-vault-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-vault-600 dark:text-vault-400">
                    Context Usage
                  </span>
                  <span className={`text-xs font-medium ${
                    usageData.status === 'good' 
                      ? 'text-green-600 dark:text-green-400' 
                      : usageData.status === 'warning'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {usageData.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-vault-200 dark:bg-vault-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full transition-all duration-300 ${
                      usageData.status === 'good'
                        ? 'bg-green-500'
                        : usageData.status === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${usageData.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-vault-500 dark:text-vault-400">
                    {usageData.tokenCount.toLocaleString()} / {contextLimit.toLocaleString()} tokens
                  </span>
                  {usageData.status === 'danger' && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3 h-3" />
                      Over limit
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Info about auto-included section */}
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                <Info className="w-4 h-4 shrink-0" />
                <span>Current section is automatically included</span>
              </div>
            </div>

            {contextSections.length === 0 ? (
              <div className="text-center py-4 text-vault-400 dark:text-vault-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No context selected</p>
                <p className="text-xs mt-1">Add sections to provide context for AI</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {contextSections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-white dark:bg-vault-800 border-vault-200 dark:border-vault-700"
                  >
                    <span className="text-sm font-medium text-vault-900 dark:text-vault-100">
                      {section.label}
                    </span>
                    <button
                      onClick={() => removeContextSection(section.id)}
                      className="p-1.5 text-vault-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors ml-2"
                      title="Remove from context"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Context Section - Collapsible */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <button
          onClick={() => setIsAddContextExpanded(!isAddContextExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-vault-200 dark:border-vault-800 hover:bg-vault-100 dark:hover:bg-vault-800/50 transition-colors shrink-0"
        >
          <h3 className="text-xs font-medium text-vault-500 dark:text-vault-400 uppercase tracking-wide">
            Add Context
          </h3>
          {isAddContextExpanded ? (
            <ChevronUp className="w-4 h-4 text-vault-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-vault-400" />
          )}
        </button>

        {isAddContextExpanded && (
          <>
            {/* Search Input */}
            <div className="p-4 border-b border-vault-200 dark:border-vault-800 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vault-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sections..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-vault-300 dark:border-vault-700 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 placeholder-vault-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
                />
              </div>
            </div>

            {/* Available Sections List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredSections.length === 0 ? (
                <div className="text-center py-8 text-vault-400 dark:text-vault-500">
                  <p className="text-sm">
                    {searchQuery.trim() ? 'No matching sections found' : 'All sections are in context'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => {
                        addContextSection(section.id);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-3 bg-white dark:bg-vault-800 hover:bg-vault-100 dark:hover:bg-vault-700 border border-vault-200 dark:border-vault-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-vault-900 dark:text-vault-100 truncate group-hover:text-vault-600 dark:group-hover:text-vault-400">
                            {section.label}
                          </p>
                          <p className="text-xs text-vault-500 mt-1">
                            {section.description}
                          </p>
                        </div>
                        <Plus className="w-4 h-4 text-vault-400 group-hover:text-vault-600 dark:group-hover:text-vault-400 shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ContextPanel;

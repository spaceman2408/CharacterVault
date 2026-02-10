/**
 * @fileoverview Character editor context provider component.
 * @module context/CharacterEditorContext
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Character, CharacterSection } from '../db/characterTypes';
import type { SamplerSettings, AIConfig, PromptSettings } from '../db/types';
import { DEFAULT_SETTINGS } from '../db/types';
import { useCharacterContext } from './useCharacterContext';
import { CharacterEditorContext, type CharacterEditorContextValue, type SaveStatus, type AIOperation } from './characterEditorContextTypes';
import { characterSettingsService } from '../services/CharacterSettingsService';

/**
 * Props for the CharacterEditorProvider component
 */
interface CharacterEditorProviderProps {
  children: React.ReactNode;
}

/**
 * CharacterEditorProvider - Provides character editor state and operations
 * 
 * Features:
 * - Current character management
 * - Auto-save functionality (debounced)
 * - Save status tracking
 * - AI settings and context management
 * 
 * @param props - Component props
 * @returns React element
 */
export default function CharacterEditorProvider({ children }: CharacterEditorProviderProps): React.ReactElement {
  const { currentCharacter, updateCharacter: updateCharacterBase, updateSpecField: updateSpecFieldBase } = useCharacterContext();
  
  const [activeSection, setActiveSection] = useState<CharacterSection>('name');
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [fontSize, setFontSizeState] = useState(16);
  
  // AI-related state
  const [selectedText, setSelectedText] = useState('');
  const [userAddedContextIds, setUserAddedContextIds] = useState<CharacterSection[]>([]);
  const [removedSectionIds, setRemovedSectionIds] = useState<CharacterSection[]>([]);
  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_SETTINGS.ai);
  const [samplerSettings, setSamplerSettings] = useState<SamplerSettings>(DEFAULT_SETTINGS.sampler);
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(DEFAULT_SETTINGS.prompts);

  // Context sections = active section (unless removed) + user-added sections
  const contextSectionIds = React.useMemo<CharacterSection[]>(() => {
    // Auto-add active section unless it's been removed or is image/extensions
    const autoContext = ['image', 'extensions'].includes(activeSection) || removedSectionIds.includes(activeSection)
      ? [] 
      : [activeSection];
    
    // Merge with user-added, deduplicate, exclude removed
    return [...new Set([...autoContext, ...userAddedContextIds])].filter(
      id => !removedSectionIds.includes(id)
    );
  }, [activeSection, userAddedContextIds, removedSectionIds]);

  // Function to reload settings from database
  const reloadSettings = useCallback(async () => {
    try {
      const [config, sampler, prompts, settings] = await Promise.all([
        characterSettingsService.getAISettings(),
        characterSettingsService.getSamplerSettings(),
        characterSettingsService.getPromptSettings(),
        characterSettingsService.getSettings(),
      ]);
      setAIConfig(config);
      setSamplerSettings(sampler);
      setPromptSettings(prompts);
      setFontSizeState(settings.ui.editorFontSize);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  // Initialize settings when component mounts (defer to avoid setState in render warning)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void reloadSettings();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [reloadSettings]);

  // Update CSS variable when font size changes
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  }, [fontSize]);

  // Clear removed sections when navigating so they can be auto-added again
  // Using a ref to track previous active section to avoid cascading renders
  const prevActiveSectionRef = useRef<CharacterSection>(activeSection);
  
  useEffect(() => {
    if (prevActiveSectionRef.current !== activeSection) {
      prevActiveSectionRef.current = activeSection;
      // Use setTimeout to defer state update and avoid cascading renders
      const timeoutId = setTimeout(() => {
        setRemovedSectionIds([]);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [activeSection]);

  /**
   * Update the character
   */
  const updateCharacter = useCallback(async (input: Partial<Character>): Promise<Character> => {
    if (!currentCharacter) {
      throw new Error('No character is currently open');
    }

    const updated = await updateCharacterBase(currentCharacter.id, input);
    setIsDirty(false);
    setSaveStatus('saved');
    return updated;
  }, [currentCharacter, updateCharacterBase]);

  /**
   * Update a specific spec field
   */
  const updateSpecField = useCallback(async (
    field: keyof Character['data']['spec'],
    value: string | string[]
  ): Promise<Character> => {
    if (!currentCharacter) {
      throw new Error('No character is currently open');
    }

    // Mark as dirty immediately
    setIsDirty(true);
    setSaveStatus('saving');

    try {
      // Save immediately to database
      const updated = await updateSpecFieldBase(
        currentCharacter.id,
        field,
        value
      );
      
      setIsDirty(false);
      setSaveStatus('saved');
      
      return updated;
    } catch (error) {
      console.error('Failed to save spec field:', error);
      setSaveStatus('error');
      throw error;
    }
  }, [currentCharacter, updateSpecFieldBase]);

  /**
   * Set font size
   */
  const setFontSize = useCallback(async (size: number) => {
    setFontSizeState(size);
    
    // Update CSS variable
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
    
    // Persist to database
    try {
      const settings = await characterSettingsService.getSettings();
      await characterSettingsService.saveSettings({
        ...settings,
        ui: {
          ...settings.ui,
          editorFontSize: size,
        },
      });
    } catch (error) {
      console.error('Failed to save font size:', error);
    }
  }, []);

  /**
   * Set context section IDs (replaces user-added sections)
   * Note: The active section is always included automatically
   */
  const setContextSectionIdsCallback = useCallback((ids: CharacterSection[] | ((prev: CharacterSection[]) => CharacterSection[])) => {
    setUserAddedContextIds(prev => {
      const newIds = typeof ids === 'function' ? ids(prev) : ids;
      // Filter out the active section since it's auto-included
      const userIds = newIds.filter(id => id !== activeSection);
      // Persist to database
      void characterSettingsService.saveContextSectionIds(userIds);
      return userIds;
    });
  }, [activeSection]);

  /**
   * Add a context section (user-added)
   */
  const addContextSection = useCallback((sectionId: CharacterSection) => {
    // Remove from removed list (if it was previously removed)
    setRemovedSectionIds(prev => prev.filter(id => id !== sectionId));
    
    setUserAddedContextIds(prev => {
      if (prev.includes(sectionId)) return prev;
      const newIds = [...prev, sectionId];
      void characterSettingsService.addContextSection(sectionId);
      return newIds;
    });
  }, []);

  /**
   * Remove a context section (user-added or auto-added)
   */
  const removeContextSection = useCallback((sectionId: CharacterSection) => {
    // Add to removed list to prevent auto-re-adding
    setRemovedSectionIds(prev => [...new Set([...prev, sectionId])]);
    
    setUserAddedContextIds(prev => {
      const newIds = prev.filter(id => id !== sectionId);
      void characterSettingsService.removeContextSection(sectionId);
      return newIds;
    });
  }, []);

  /**
   * Update AI configuration
   */
  const updateAIConfig = useCallback((config: Partial<AIConfig>) => {
    setAIConfig(prev => {
      const newConfig = { ...prev, ...config };
      void characterSettingsService.saveAISettings(newConfig);
      return newConfig;
    });
  }, []);

  /**
   * Update sampler settings
   */
  const updateSamplerSettings = useCallback((settings: Partial<SamplerSettings>) => {
    setSamplerSettings(prev => {
      const newSettings = { ...prev, ...settings };
      void characterSettingsService.saveSamplerSettings(newSettings);
      return newSettings;
    });
  }, []);

  /**
   * Update prompt settings
   */
  const updatePromptSettings = useCallback((settings: Partial<PromptSettings>) => {
    setPromptSettings(prev => {
      const newSettings = { ...prev, ...settings };
      void characterSettingsService.savePromptSettings(newSettings);
      return newSettings;
    });
  }, []);

  /**
   * Get context content for AI from selected sections
   */
  const getContextContent = useCallback((sectionIds: CharacterSection[]): string[] => {
    if (!currentCharacter) return [];
    
    return sectionIds.map(sectionId => {
      const spec = currentCharacter.data.spec;
      switch (sectionId) {
        case 'name':
          return `Character Name: ${spec.name}`;
        case 'description':
          return `Description:\n${spec.description}`;
        case 'personality':
          return `Personality:\n${spec.personality}`;
        case 'scenario':
          return `Scenario:\n${spec.scenario}`;
        case 'first_mes':
          return `First Message:\n${spec.first_mes}`;
        case 'mes_example':
          return `Message Examples:\n${spec.mes_example}`;
        case 'system_prompt':
          return `System Prompt:\n${spec.system_prompt}`;
        case 'post_history_instructions':
          return `Post-History Instructions:\n${spec.post_history_instructions}`;
        case 'alternate_greetings':
          return `Alternate Greetings:\n${spec.alternate_greetings.join('\n---\n')}`;
        case 'physical_description':
          return `Physical Description:\n${spec.physical_description}`;
        // V3 spec fields
        case 'avatar':
          return spec.avatar ? `Avatar URL: ${spec.avatar}` : '';
        case 'creator_notes':
          return spec.creator_notes ? `Creator Notes:\n${spec.creator_notes}` : '';
        case 'creator':
          return spec.creator ? `Creator: ${spec.creator}` : '';
        case 'character_version':
          return spec.character_version ? `Version: ${spec.character_version}` : '';
        case 'tags':
          return spec.tags?.length ? `Tags: ${spec.tags.join(', ')}` : '';
        case 'lorebook': {
          const book = currentCharacter.data.characterBook;
          if (!book || book.entries.length === 0) return '';
          
          const enabledEntries = book.entries.filter(e => e.enabled);
          if (enabledEntries.length === 0) return '';
          
          let loreContent = `Lorebook: ${book.name || 'Character Lore'}\n`;
          if (book.description) {
            loreContent += `${book.description}\n`;
          }
          loreContent += '\n';
          
          enabledEntries.forEach(entry => {
            loreContent += `[Entry ${entry.id}]`;
            if (entry.name) loreContent += ` ${entry.name}`;
            loreContent += '\n';
            loreContent += `Keys: ${entry.keys.join(', ')}\n`;
            if (entry.comment) loreContent += `Note: ${entry.comment}\n`;
            loreContent += `${entry.content}\n\n`;
          });
          
          return loreContent.trim();
        }
        default:
          return '';
      }
    }).filter(content => content.length > 0);
  }, [currentCharacter]);

  /**
   * Handle AI operation result
   */
  const handleAIOperation = useCallback((result: string, operation: AIOperation, originalSelectedText?: string) => {
    if (!currentCharacter || !activeSection) return;
    
    // Get current field value
    const spec = currentCharacter.data.spec;
    let currentValue: string;
    
    switch (activeSection) {
      case 'name':
        currentValue = spec.name;
        break;
      case 'description':
        currentValue = spec.description;
        break;
      case 'personality':
        currentValue = spec.personality;
        break;
      case 'scenario':
        currentValue = spec.scenario;
        break;
      case 'first_mes':
        currentValue = spec.first_mes;
        break;
      case 'mes_example':
        currentValue = spec.mes_example;
        break;
      case 'system_prompt':
        currentValue = spec.system_prompt;
        break;
      case 'post_history_instructions':
        currentValue = spec.post_history_instructions;
        break;
      case 'alternate_greetings':
        currentValue = spec.alternate_greetings.join('\n---\n');
        break;
      case 'physical_description':
        currentValue = spec.physical_description;
        break;
      // V3 spec fields
      case 'avatar':
        currentValue = spec.avatar || '';
        break;
      case 'creator_notes':
        currentValue = spec.creator_notes || '';
        break;
      case 'creator':
        currentValue = spec.creator || '';
        break;
      case 'character_version':
        currentValue = spec.character_version || '';
        break;
      case 'tags':
        currentValue = spec.tags?.join(', ') || '';
        break;
      default:
        return;
    }
    
    // Use the passed original selected text, or fall back to state (for backwards compatibility)
    const textToReplace = originalSelectedText ?? selectedText;
    
    let newContent: string;
    
    switch (operation) {
      case 'expand':
      case 'rewrite':
      case 'instruct':
        // Replace selected text with result
        if (textToReplace) {
          // Find the first occurrence of the selected text and replace it
          const index = currentValue.indexOf(textToReplace);
          
          if (index !== -1) {
            newContent =
              currentValue.substring(0, index) +
              result +
              currentValue.substring(index + textToReplace.length);
          } else {
            // Text not found - try with trimmed whitespace
            const trimmedSearch = textToReplace.trim();
            const trimmedIndex = currentValue.indexOf(trimmedSearch);
            
            if (trimmedIndex !== -1) {
              newContent =
                currentValue.substring(0, trimmedIndex) +
                result +
                currentValue.substring(trimmedIndex + trimmedSearch.length);
            } else {
              // Still not found - append as fallback
              console.warn('AI operation: Selected text not found in content, appending instead');
              newContent = currentValue + '\n\n' + result;
            }
          }
        } else {
          // No text selected - append result
          newContent = currentValue + '\n\n' + result;
        }
        break;
      case 'ask':
        // For ask operation, just insert at cursor or append
        newContent = currentValue + '\n\n' + result;
        break;
      default:
        newContent = currentValue;
    }
    
    // Update the spec field
    if (activeSection === 'alternate_greetings') {
      void updateSpecField(activeSection, newContent.split('\n---\n').filter(g => g.trim()));
    } else if (activeSection === 'tags') {
      // Convert comma-separated string to array for tags
      void updateSpecField(activeSection, newContent.split(',').map(t => t.trim()).filter(t => t));
    } else {
      void updateSpecField(activeSection, newContent);
    }
    
    // Clear selected text
    setSelectedText('');
  }, [currentCharacter, activeSection, selectedText, updateSpecField]);

  const value: CharacterEditorContextValue = {
    currentCharacter,
    activeSection,
    isDirty,
    saveStatus,
    fontSize,
    selectedText,
    contextSectionIds,
    userAddedContextIds,
    aiConfig,
    samplerSettings,
    promptSettings,
    setActiveSection,
    updateCharacter,
    updateSpecField,
    setFontSize,
    setSelectedText,
    setContextSectionIds: setContextSectionIdsCallback,
    addContextSection,
    removeContextSection,
    updateAIConfig,
    updateSamplerSettings,
    updatePromptSettings,
    handleAIOperation,
    getContextContent,
    reloadSettings,
  };

  return (
    <CharacterEditorContext.Provider value={value}>
      {children}
    </CharacterEditorContext.Provider>
  );
}

// Named export for the provider
export { CharacterEditorProvider };

/**
 * @fileoverview AI Creation Studio page
 * @module @pages/ai-creation-studio/AICreationStudio
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings2,
  Sparkles,
  Loader2,
  Save,
  CheckCircle,
  ExternalLink,
  Library,
  Wand2,
} from 'lucide-react';
import { useCharacterContext } from '../../context';
import { CharacterSettingsPanel } from '../../components/settings/CharacterSettingsPanel';
import { useAIGeneration } from './useAIGeneration';
import { ConceptInput } from './ConceptInput';
import { GenerationProgress } from './GenerationProgress';
import { GeneratedCardPreview } from './GeneratedCardPreview';
import type { GenerationField } from './types';

export const AICreationStudio: React.FC = () => {
  const navigate = useNavigate();
  const { createCharacter } = useCharacterContext();

  const {
    state,
    isConfigured,
    isLoading,
    start,
    abort,
    retryField,
    reloadConfig,
    updateGeneratedField,
  } = useAIGeneration();

  const [concept, setConcept] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedCharacterId, setSavedCharacterId] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    if (saveSuccess) {
      setSaveSuccess(false);
      setSavedCharacterId(null);
    }
    void start(concept);
  }, [start, concept, saveSuccess]);

  const handleAbort = useCallback(() => {
    abort();
  }, [abort]);

  const handleRetryField = useCallback(
    (field: GenerationField) => {
      void retryField(field);
    },
    [retryField]
  );

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSettingsSaved = useCallback(async () => {
    await reloadConfig();
  }, [reloadConfig]);

  const handleSaveToVault = useCallback(async () => {
    if (!state.generatedData.name) return;

    setIsSaving(true);
    try {
      const character = await createCharacter({
        name: state.generatedData.name,
        data: {
          spec: {
            name: state.generatedData.name || '',
            description: state.generatedData.description || '',
            personality: '',
            scenario: '',
            first_mes: state.generatedData.first_mes || '',
            mes_example: state.generatedData.mes_example || '',
            system_prompt: '',
            post_history_instructions: '',
            alternate_greetings: [],
            physical_description: '',
          },
        },
      });

      setSavedCharacterId(character.id);
      setSaveSuccess(true);
    } catch {
      // Error is handled by UI state, but we could add toast here
    } finally {
      setIsSaving(false);
    }
  }, [state.generatedData, createCharacter]);

  const handleOpenCharacter = useCallback(() => {
    if (savedCharacterId) {
      navigate(`/?char=${savedCharacterId}`);
    }
  }, [savedCharacterId, navigate]);

  const handleBackToLibrary = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCreateAnother = useCallback(() => {
    setConcept('');
    setSaveSuccess(false);
    setSavedCharacterId(null);
  }, []);

  const hasGeneratedContent = Object.keys(state.generatedData).length > 0;
  const canSave = state.status === 'complete' || (hasGeneratedContent && state.generatedData.name);
  const showEmptyState = !hasGeneratedContent && !saveSuccess && !isLoading;

  return (
    <div className="h-dvh flex flex-col bg-vault-50 dark:bg-vault-950 text-vault-900 dark:text-vault-100 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 w-full backdrop-blur-xl bg-white/80 dark:bg-vault-950/80 border-b border-vault-200 dark:border-vault-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToLibrary}
              className="p-2 rounded-lg transition-all duration-200 active:scale-95 text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-100 hover:bg-vault-100 dark:hover:bg-vault-800"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-vault-600 dark:text-vault-400" />
              <h1 className="text-lg font-semibold">AI Creation Studio</h1>
            </div>
          </div>

          <button
            onClick={handleOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-vault-600 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Success State */}
          {saveSuccess && savedCharacterId && (
            <div className="mb-6 animate-fade-in">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-green-800 dark:text-green-300 mb-2">
                  Character Saved!
                </h2>
                <p className="text-green-700 dark:text-green-400 mb-6">
                  <span className="font-medium text-green-900 dark:text-green-200">
                    {state.generatedData.name}
                  </span>{' '}
                  has been added to your vault.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                  <button
                    onClick={handleOpenCharacter}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-vault-900 dark:bg-vault-50 text-white dark:text-vault-900 font-medium rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Character
                  </button>
                  <button
                    onClick={handleCreateAnother}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 border border-vault-300 dark:border-vault-700 text-vault-700 dark:text-vault-300 font-medium rounded-xl hover:bg-vault-50 dark:hover:bg-vault-900 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create Another
                  </button>
                  <button
                    onClick={handleBackToLibrary}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 text-vault-500 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200 transition-colors"
                  >
                    <Library className="w-4 h-4" />
                    Library
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Layout */}
          {!saveSuccess && (
            <div className={`grid gap-6 ${showEmptyState ? 'max-w-2xl mx-auto' : 'grid-cols-1 lg:grid-cols-2'}`}>
              {/* Left Panel - Input & Progress */}
              <div className="space-y-6">
                {/* Concept Input */}
                <div className={`bg-white dark:bg-vault-900 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-sm ${showEmptyState ? 'p-8' : 'p-6'}`}>
                  <ConceptInput
                    concept={concept}
                    onConceptChange={setConcept}
                    onGenerate={handleGenerate}
                    onAbort={handleAbort}
                    isConfigured={isConfigured}
                    isGenerating={isLoading}
                    onOpenSettings={handleOpenSettings}
                  />
                </div>

                {/* Empty state illustration — centered when no content yet */}
                {showEmptyState && (
                  <div className="hidden lg:flex flex-col items-center justify-center py-8 text-center opacity-50">
                    <div className="w-14 h-14 rounded-2xl bg-vault-100 dark:bg-vault-800 flex items-center justify-center mb-3">
                      <Wand2 className="w-7 h-7 text-vault-400 dark:text-vault-500" />
                    </div>
                    <p className="text-sm font-medium text-vault-600 dark:text-vault-400">
                      Your generated character will appear here
                    </p>
                    <p className="text-xs text-vault-500 dark:text-vault-500 mt-1 max-w-xs">
                      Enter a concept and click Generate to create name, description, first message, and examples.
                    </p>
                  </div>
                )}

                {hasGeneratedContent && (
                  <div className="bg-white dark:bg-vault-900 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-sm p-6">
                    <GenerationProgress
                      state={state}
                      onRetryField={handleRetryField}
                    />
                  </div>
                )}
              </div>

              {/* Right Panel - Preview */}
              {!showEmptyState && (
                <div className="space-y-6">
                  {hasGeneratedContent && (
                    <>
                      <div className="bg-white dark:bg-vault-900 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-sm p-6">
                        <GeneratedCardPreview
                          generatedData={state.generatedData}
                          onFieldChange={updateGeneratedField}
                        />
                      </div>

                      {/* Save button area */}
                      {canSave && (
                        <div className="flex justify-end">
                          <button
                            onClick={handleSaveToVault}
                            disabled={isSaving || !state.generatedData.name}
                            className="flex items-center gap-2 px-6 py-2.5 bg-vault-900 dark:bg-vault-50 text-white dark:text-vault-900 font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            {isSaving ? 'Saving...' : 'Save to Vault'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Settings Panel */}
      <CharacterSettingsPanel
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
        reloadSettings={handleSettingsSaved}
      />
    </div>
  );
};

export default AICreationStudio;

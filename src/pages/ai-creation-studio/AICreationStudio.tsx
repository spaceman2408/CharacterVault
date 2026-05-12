/**
 * @fileoverview AI Creation Studio page
 * @module @pages/ai-creation-studio/AICreationStudio
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import { useCharacterContext } from '../../context';
import { CharacterSettingsPanel } from '../../components/settings/CharacterSettingsPanel';
import { characterSettingsService } from '../../services/CharacterSettingsService';
import { useAIGeneration } from './useAIGeneration';
import { ConceptInput } from './ConceptInput';
import { GenerationProgress } from './GenerationProgress';
import { GeneratedCardPreview } from './GeneratedCardPreview';
import { TagVortexOverlay } from './TagVortexOverlay';
import { randomizeTags } from './tags/tagData';
import { buildConceptFromTags, formatTag, TAG_CATEGORIES } from './tags/tagData';
import type { GenerationField } from './types';
import type { InputMode } from './types';
import { GENERATION_FIELDS } from './types';

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
    regenerateField,
    continueGeneration,
    reloadConfig,
    updateGeneratedField,
    reset,
  } = useAIGeneration();

  const [concept, setConcept] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('write');
  const [tagSelections, setTagSelections] = useState<Record<string, string[]>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedCharacterId, setSavedCharacterId] = useState<string | null>(null);
  const [vortexActive, setVortexActive] = useState(false);
  const [vortexTags, setVortexTags] = useState<string[]>([]);
  const [showLuckyVortexSetting, setShowLuckyVortexSetting] = useState(true);
  const [fadeInputModal, setFadeInputModal] = useState(false);

  // Load "Show Lucky Vortex" setting on mount
  useEffect(() => {
    void characterSettingsService.getSettings().then((settings) => {
      setShowLuckyVortexSetting(settings.ui?.showLuckyVortex ?? true);
    });
  }, []);

  const handleReloadSettings = useCallback(async () => {
    await reloadConfig();
    const settings = await characterSettingsService.getSettings();
    setShowLuckyVortexSetting(settings.ui?.showLuckyVortex ?? true);
  }, [reloadConfig]);

  const handleInputModeChange = useCallback(
    (mode: InputMode) => {
      if (mode === 'write' && inputMode === 'tags') {
        const derived = buildConceptFromTags(tagSelections);
        if (derived) setConcept(derived);
      }
      setInputMode(mode);
    },
    [inputMode, tagSelections]
  );

  const handleGenerate = useCallback(() => {
    if (saveSuccess) {
      setSaveSuccess(false);
      setSavedCharacterId(null);
    }
    const text = inputMode === 'tags' ? buildConceptFromTags(tagSelections) : concept;
    void start(text);
  }, [start, concept, tagSelections, inputMode, saveSuccess]);

  const handleAbort = useCallback(() => {
    abort();
  }, [abort]);

  const handleFeelingLucky = useCallback(() => {
    const randomized = randomizeTags(tagSelections);
    setTagSelections(randomized);

       if (showLuckyVortexSetting) {
        const allSelected = Object.values(randomized).flat();
        setVortexTags(allSelected);
        setVortexActive(true);
    } else {
      const text = buildConceptFromTags(randomized);
      if (text) {
        if (saveSuccess) {
          setSaveSuccess(false);
          setSavedCharacterId(null);
        }
        void start(text);
      }
    }
  }, [tagSelections, showLuckyVortexSetting, start, saveSuccess]);

  const handleVortexAnimationStart = useCallback(() => {
    setFadeInputModal(true);
  }, []);

  const handleVortexComplete = useCallback(() => {
    setVortexActive(false);
    setFadeInputModal(false);
    const text = buildConceptFromTags(tagSelections);
    if (text) {
      if (saveSuccess) {
        setSaveSuccess(false);
        setSavedCharacterId(null);
      }
      void start(text);
    }
  }, [tagSelections, start, saveSuccess]);

  const handleRetryField = useCallback(
    (field: GenerationField) => {
      void retryField(field);
    },
    [retryField]
  );

  const handleRegenerateField = useCallback(
    (field: GenerationField) => {
      void regenerateField(field);
    },
    [regenerateField]
  );

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSettingsSaved = useCallback(async () => {
    await handleReloadSettings();
  }, [handleReloadSettings]);

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
      // Error is handled by UI state
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
    // Force full page reload to ensure fresh state and return to vault view
    // This prevents the editor from opening with a previously selected character
    window.location.href = import.meta.env.BASE_URL;
  }, []);

  const handleCreateAnother = useCallback(() => {
    // Clear all form state
    setConcept('');
    setTagSelections({});
    setInputMode('write');

    // Clear success state
    setSaveSuccess(false);
    setSavedCharacterId(null);

    // Reset vortex state
    setVortexActive(false);
    setVortexTags([]);
    setFadeInputModal(false);

    // Fully reset generation state
    reset();
  }, [reset]);

  const handleGoBack = useCallback(() => {
    // Abort any ongoing generation first
    if (isLoading) {
      abort();
    }
    reset();
    setConcept('');
    setTagSelections({});
    setInputMode('write');
    setVortexActive(false);
    setVortexTags([]);
    setFadeInputModal(false);
  }, [reset, abort, isLoading]);

  const hasGeneratedContent = Object.keys(state.generatedData).length > 0;
  const canSave = state.status === 'complete' || (hasGeneratedContent && state.generatedData.name);
  const showEmptyState = state.status === 'idle' && !saveSuccess;
  const remainingFields = GENERATION_FIELDS.filter((f) => !state.completedFields.includes(f.key));
  const hasRemainingFields = remainingFields.length > 0;

  return (
    <div className="h-dvh flex flex-col bg-vault-50 dark:bg-vault-950 text-vault-900 dark:text-vault-100 overflow-hidden">
      {/* Vortex Animation Overlay */}
      <TagVortexOverlay
        selectedTags={vortexTags}
        isVisible={vortexActive}
        onComplete={handleVortexComplete}
        onAnimationStart={handleVortexAnimationStart}
      />

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
            <div className={`grid gap-6 ${hasGeneratedContent ? 'grid-cols-1 lg:grid-cols-2' : 'max-w-2xl mx-auto'}`}>
              {/* Left Panel - Input & Progress */}
              <div className="space-y-6">
                {/* Concept Input — hidden during generation or when results exist */}
                {showEmptyState && (
                  <div 
                    className={`bg-white dark:bg-vault-900 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-sm p-8 transition-opacity duration-200 ${
                      fadeInputModal ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    <ConceptInput
                      concept={concept}
                      onConceptChange={setConcept}
                      tagSelections={tagSelections}
                      onTagSelectionsChange={setTagSelections}
                      onFeelingLucky={handleFeelingLucky}
                      inputMode={inputMode}
                      onInputModeChange={handleInputModeChange}
                      onGenerate={handleGenerate}
                      onAbort={handleAbort}
                      isConfigured={isConfigured}
                      isGenerating={isLoading}
                      onOpenSettings={handleOpenSettings}
                    />
                  </div>
                )}

                {/* Compact generation-progress card with Go Back */}
                {isLoading && (
                  <div className="bg-white dark:bg-vault-900 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-vault-900 dark:text-vault-100">
                          Generating character...
                        </p>
                        <p className="text-xs text-vault-500 dark:text-vault-400">
                          This may take a moment.
                        </p>
                      </div>
                      <button
                        onClick={handleGoBack}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-vault-600 dark:text-vault-300 border border-vault-300 dark:border-vault-700 rounded-lg hover:bg-vault-50 dark:hover:bg-vault-800 active:scale-[0.98] transition-all"
                        title="Cancel and start over"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Go Back
                      </button>
                    </div>

                    {/* Tags used for this generation */}
                    {inputMode === 'tags' && (
                      <div className="pt-3 border-t border-vault-100 dark:border-vault-800">
                        <p className="text-[10px] font-semibold text-vault-500 dark:text-vault-400 uppercase tracking-wider mb-2">
                          Tags used
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {TAG_CATEGORIES.flatMap((cat) =>
                            (tagSelections[cat.key] ?? []).map((tag) => (
                              <span
                                key={`${cat.key}-${tag}`}
                                className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                              >
                                {formatTag(tag)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {inputMode === 'write' && concept && (
                      <div className="pt-3 border-t border-vault-100 dark:border-vault-800">
                        <p className="text-[10px] font-semibold text-vault-500 dark:text-vault-400 uppercase tracking-wider mb-1">
                          Concept
                        </p>
                        <p className="text-sm text-vault-700 dark:text-vault-300 italic">
                          &ldquo;{concept}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Status card when generation is done or errored */}
                {!showEmptyState && !isLoading && (
                  <div className="bg-white dark:bg-vault-900 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        {state.status === 'error' ? (
                          <>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                              Generation Failed
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                              {state.error || 'Something went wrong during generation.'}
                            </p>
                          </>
                        ) : hasRemainingFields ? (
                          <>
                            <p className="text-sm font-semibold text-vault-900 dark:text-vault-100">
                              Partially Complete
                            </p>
                            <p className="text-xs text-vault-500 dark:text-vault-400">
                              {remainingFields.length} field{remainingFields.length > 1 ? 's' : ''} remaining: {remainingFields.map((f) => f.label).join(', ')}.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-vault-900 dark:text-vault-100">
                              Character Complete
                            </p>
                            <p className="text-xs text-vault-500 dark:text-vault-400">
                              Review or save your character, or start over.
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasRemainingFields && (
                          <button
                            onClick={() => void continueGeneration()}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-vault-700 dark:text-vault-200 bg-vault-100 dark:bg-vault-800 border border-vault-300 dark:border-vault-700 rounded-lg hover:bg-vault-200 dark:hover:bg-vault-700 active:scale-[0.98] transition-all"
                            title="Continue generating remaining fields"
                          >
                            <Sparkles className="w-4 h-4" />
                            Continue
                          </button>
                        )}
                        <button
                          onClick={handleGoBack}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-vault-600 dark:text-vault-300 border border-vault-300 dark:border-vault-700 rounded-lg hover:bg-vault-50 dark:hover:bg-vault-800 active:scale-[0.98] transition-all"
                          title="Start a new character"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Go Back
                        </button>
                      </div>
                    </div>

                    {/* Tags used — persisted after generation completes */}
                    {inputMode === 'tags' && Object.values(tagSelections).some((t) => t.length > 0) && (
                      <div className="pt-3 mt-3 border-t border-vault-100 dark:border-vault-800">
                        <p className="text-[10px] font-semibold text-vault-500 dark:text-vault-400 uppercase tracking-wider mb-2">
                          Tags used
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {TAG_CATEGORIES.flatMap((cat) =>
                            (tagSelections[cat.key] ?? []).map((tag) => (
                              <span
                                key={`${cat.key}-${tag}`}
                                className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                              >
                                {formatTag(tag)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {inputMode === 'write' && concept && (
                      <div className="pt-3 mt-3 border-t border-vault-100 dark:border-vault-800">
                        <p className="text-[10px] font-semibold text-vault-500 dark:text-vault-400 uppercase tracking-wider mb-1">
                          Concept
                        </p>
                        <p className="text-sm text-vault-700 dark:text-vault-300 italic">
                          &ldquo;{concept}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {state.status !== 'idle' && (
                  <div className="bg-white dark:bg-vault-900 rounded-2xl border border-vault-200 dark:border-vault-800 shadow-sm p-6">
                    <GenerationProgress
                      state={state}
                      isLoading={isLoading}
                      onGenerateField={handleRetryField}
                      onRegenerateField={handleRegenerateField}
                    />
                  </div>
                )}
              </div>

              {/* Right Panel - Preview */}
              {hasGeneratedContent && (
                <div className="space-y-6">
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

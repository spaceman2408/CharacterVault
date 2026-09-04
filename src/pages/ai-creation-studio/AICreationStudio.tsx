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
  X,
} from 'lucide-react';
import { useCharacterContext, useLorebookContext } from '../../context';
import { CharacterSettingsPanel } from '../../components/settings/CharacterSettingsPanel';
import { characterSettingsService } from '../../services/CharacterSettingsService';
import { useAIGeneration } from './useAIGeneration';
import { useStudioTags } from './useStudioTags';
import { ConceptInput } from './ConceptInput';
import { GenerationProgress } from './GenerationProgress';
import { GeneratedCardPreview } from './GeneratedCardPreview';
import { TagVortexOverlay } from './TagVortexOverlay';
import { randomizeTags } from './tags/tagData';
import { buildConceptFromTags, formatTag, getGenerationTags, hasRequiredGenerationTags } from './tags/tagData';
import type { GenerationField } from './types';
import type { InputMode } from './types';
import { GENERATION_FIELDS } from './types';

export const AICreationStudio: React.FC = () => {
  const navigate = useNavigate();
  const { createCharacter, closeCharacter } = useCharacterContext();
  const { closeLorebook } = useLorebookContext();

  // Drop full open workspaces so studio does not retain card/book payloads
  useEffect(() => {
    closeCharacter();
    closeLorebook();
  }, [closeCharacter, closeLorebook]);

  const {
    state,
    isConfigured,
    isLoading,
    enabledFields,
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
  const {
    allCategories,
    visibleCategories,
    hideNsfw,
    favorites,
    recent,
    addCustomTag,
    removeCustomTag,
    toggleFavorite,
    trackUsed,
    reload: reloadTagPrefs,
  } = useStudioTags();
  const hiddenCategoryCount = allCategories.length - visibleCategories.length;
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
    await reloadTagPrefs();
    const settings = await characterSettingsService.getSettings();
    setShowLuckyVortexSetting(settings.ui?.showLuckyVortex ?? true);
  }, [reloadConfig, reloadTagPrefs]);

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
    if (!hasRequiredGenerationTags(tagSelections)) return;
    if (saveSuccess) {
      setSaveSuccess(false);
      setSavedCharacterId(null);
    }
    const text = inputMode === 'tags' ? buildConceptFromTags(tagSelections) : concept;
    const tags = getGenerationTags(tagSelections);
    trackUsed(tagSelections);
    void start(text, tags);
  }, [start, concept, tagSelections, inputMode, saveSuccess, trackUsed]);

  const handleAbort = useCallback(() => {
    abort();
  }, [abort]);

  const handleFeelingLucky = useCallback(() => {
    if (!hasRequiredGenerationTags(tagSelections)) return;
    const randomized = randomizeTags(tagSelections, [], { includeNsfw: !hideNsfw });
    setTagSelections(randomized);

    if (showLuckyVortexSetting) {
      // Exclude generation tags from the vortex display — they are not randomized
      const allSelected = Object.entries(randomized)
        .filter(([key]) => key !== 'generation')
        .flatMap(([, tags]) => tags);
      setVortexTags(allSelected);
      setVortexActive(true);
    } else {
      const text = buildConceptFromTags(randomized);
      if (text) {
        if (saveSuccess) {
          setSaveSuccess(false);
          setSavedCharacterId(null);
        }
        const tags = getGenerationTags(randomized);
        void start(text, tags);
      }
    }
  }, [tagSelections, showLuckyVortexSetting, start, saveSuccess, hideNsfw]);

  const handleVortexAnimationStart = useCallback(() => {
    setFadeInputModal(true);
  }, []);

  const handleVortexComplete = useCallback(() => {
    setVortexActive(false);
    setFadeInputModal(false);
    if (!hasRequiredGenerationTags(tagSelections)) return;
    const text = buildConceptFromTags(tagSelections);
    if (text) {
      if (saveSuccess) {
        setSaveSuccess(false);
        setSavedCharacterId(null);
      }
      const tags = getGenerationTags(tagSelections);
      void start(text, tags);
    }
  }, [tagSelections, start, saveSuccess]);

  const handleRemoveCustomTag = useCallback(
    (categoryKey: string, tag: string) => {
      void removeCustomTag(categoryKey, tag);
      setTagSelections((prev) => ({
        ...prev,
        [categoryKey]: (prev[categoryKey] ?? []).filter((t) => t !== tag),
      }));
    },
    [removeCustomTag]
  );

  const handleRetryField = useCallback(    (field: GenerationField) => {
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
      const conceptTags = allCategories
        .filter((cat) => cat.key !== 'generation')
        .flatMap((cat) => (tagSelections[cat.key] ?? []).map(formatTag));

      const mesExampleEnabled = enabledFields.mes_example !== false;
      const character = await createCharacter({
        name: state.generatedData.name,
        data: {
          spec: {
            name: state.generatedData.name || '',
            description: state.generatedData.description || '',
            personality: '',
            scenario: '',
            first_mes: state.generatedData.first_mes || '',
            mes_example: mesExampleEnabled ? state.generatedData.mes_example || '' : '',
            system_prompt: '',
            post_history_instructions: '',
            alternate_greetings: [],
            physical_description: '',
            tags: conceptTags.length > 0 ? conceptTags : undefined,
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
  }, [state.generatedData, createCharacter, tagSelections, enabledFields, allCategories]);

  const handleOpenCharacter = useCallback(() => {
    if (savedCharacterId) {
      navigate(`/?char=${savedCharacterId}`);
    }
  }, [savedCharacterId, navigate]);

  const handleBackToLibrary = useCallback(() => {
    // Abort any ongoing generation before navigating away
    if (isLoading) {
      abort();
    }
    // Force full page reload to ensure fresh state and return to vault view
    // This prevents the editor from opening with a previously selected character
    window.location.href = import.meta.env.BASE_URL;
  }, [isLoading, abort]);

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
    // Keep concept, tag selections, and input mode so the user returns
    // to exactly what they generated from.
    setVortexActive(false);
    setVortexTags([]);
    setFadeInputModal(false);
  }, [reset, abort, isLoading]);

  const hasGeneratedContent = Object.keys(state.generatedData).length > 0;
  const canSave = state.status === 'complete' || (hasGeneratedContent && state.generatedData.name);
  const showEmptyState = state.status === 'idle' && !saveSuccess;
  const activeFields = GENERATION_FIELDS.filter((f) => enabledFields[f.key] !== false);
  const remainingFields = activeFields.filter((f) => !state.completedFields.includes(f.key));
  const hasRemainingFields = remainingFields.length > 0;
  const minApiCalls = activeFields.length;

  return (
    <div className="h-dvh flex flex-col bg-bg text-fg overflow-hidden">
      {/* Vortex Animation Overlay */}
      <TagVortexOverlay
        selectedTags={vortexTags}
        isVisible={vortexActive}
        onComplete={handleVortexComplete}
        onAnimationStart={handleVortexAnimationStart}
      />

      {/* Header */}
      <header className="shrink-0 w-full backdrop-blur-xl bg-surface/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToLibrary}
              className="p-2 rounded-lg transition-all duration-200 active:scale-95 text-fg-muted hover:text-accent hover:bg-accent-soft"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h1 className="text-lg font-semibold">AI Creation Studio</h1>
            </div>
          </div>

          <button
            onClick={handleOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-accent rounded-lg transition-colors"
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
              <div className="bg-success-soft border border-success/30 rounded-xl p-6 text-center">
                <div className="w-14 h-14 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-success" />
                </div>
                <h2 className="text-xl font-bold text-success-soft-fg mb-2">
                  Character Saved!
                </h2>
                <p className="text-success mb-6">
                  <span className="font-medium text-success-soft-fg">
                    {state.generatedData.name}
                  </span>{' '}
                  has been added to your vault.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                  <button
                    onClick={handleOpenCharacter}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-accent-fg font-medium rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Character
                  </button>
                  <button
                    onClick={handleCreateAnother}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 border border-border-strong text-fg-muted font-medium rounded-xl hover:bg-hover transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create Another
                  </button>
                  <button
                    onClick={handleBackToLibrary}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 text-fg-muted hover:text-fg transition-colors"
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
                    className={`bg-surface rounded-2xl border border-border shadow-sm p-8 transition-opacity duration-200 ${
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
                      minApiCalls={minApiCalls}
                      onOpenSettings={handleOpenSettings}
                      categories={visibleCategories}
                      allCategories={allCategories}
                      hiddenCategoryCount={hiddenCategoryCount}
                      favorites={favorites}
                      recent={recent}
                      onToggleFavorite={toggleFavorite}
                      onAddCustomTag={addCustomTag}
                      onRemoveCustomTag={handleRemoveCustomTag}
                    />
                  </div>
                )}

                {/* Compact generation-progress card with Stop & Go Back */}
                {isLoading && (
                  <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-fg">
                          Generating character...
                        </p>
                        <p className="text-xs text-fg-muted">
                          This may take a moment.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleAbort}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-danger border border-danger/40 rounded-lg hover:bg-danger-soft active:scale-[0.98] transition-all"
                          title="Stop generation and keep what's been generated"
                        >
                          <X className="w-4 h-4" />
                          Stop
                        </button>
                        <button
                          onClick={handleGoBack}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-fg-muted border border-border-strong rounded-lg hover:bg-hover active:scale-[0.98] transition-all"
                          title="Cancel and return to concept input"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Go Back
                        </button>
                      </div>
                    </div>

                    {/* Tags used for this generation */}
                    {inputMode === 'tags' && (
                      <div className="pt-3 border-t border-border">
                        <p className="font-semibold text-fg-muted uppercase tracking-wider mb-2">
                          Tags used
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {allCategories.flatMap((cat) =>
                            (tagSelections[cat.key] ?? []).map((tag) => (
                              <span
                                key={`${cat.key}-${tag}`}
                                className="inline-flex items-center px-2 py-0.5 font-medium rounded-md bg-accent-soft text-accent border border-accent"
                              >
                                {formatTag(tag)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {inputMode === 'write' && concept && (
                      <div className="pt-3 border-t border-border">
                        <p className="font-semibold text-fg-muted uppercase tracking-wider mb-1">
                          Concept
                        </p>
                        <p className="text-sm text-fg-muted italic">
                          &ldquo;{concept}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Status card when generation is done or errored */}
                {!showEmptyState && !isLoading && (
                  <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        {state.status === 'error' ? (
                          <>
                            <p className="text-sm font-semibold text-danger-soft-fg">
                              Generation Failed
                            </p>
                            <p className="text-xs text-danger mt-0.5">
                              {state.error || 'Something went wrong during generation.'}
                            </p>
                          </>
                        ) : hasRemainingFields ? (
                          <>
                            <p className="text-sm font-semibold text-fg">
                              Partially Complete
                            </p>
                            <p className="text-xs text-fg-muted">
                              {remainingFields.length} field{remainingFields.length > 1 ? 's' : ''} remaining: {remainingFields.map((f) => f.label).join(', ')}.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-fg">
                              Character Complete
                            </p>
                            <p className="text-xs text-fg-muted">
                              Review or save your character, or start over.
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasRemainingFields && (
                          <button
                            onClick={() => void continueGeneration()}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-accent bg-accent-soft border border-accent rounded-lg hover:bg-accent hover:text-accent-fg active:scale-[0.98] transition-all"
                            title="Continue generating remaining fields"
                          >
                            <Sparkles className="w-4 h-4" />
                            Continue
                          </button>
                        )}
                        <button
                          onClick={handleGoBack}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-fg-muted border border-border-strong rounded-lg hover:bg-hover active:scale-[0.98] transition-all"
                          title="Start a new character"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Go Back
                        </button>
                      </div>
                    </div>

                    {/* Tags used — persisted after generation completes */}
                    {inputMode === 'tags' && Object.values(tagSelections).some((t) => t.length > 0) && (
                      <div className="pt-3 mt-3 border-t border-border">
                        <p className="font-semibold text-fg-muted uppercase tracking-wider mb-2">
                          Tags used
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {allCategories.flatMap((cat) =>
                            (tagSelections[cat.key] ?? []).map((tag) => (
                              <span
                                key={`${cat.key}-${tag}`}
                                className="inline-flex items-center px-2 py-0.5 font-medium rounded-md bg-accent-soft text-accent border border-accent"
                              >
                                {formatTag(tag)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {inputMode === 'write' && concept && (
                      <div className="pt-3 mt-3 border-t border-border">
                        <p className="font-semibold text-fg-muted uppercase tracking-wider mb-1">
                          Concept
                        </p>
                        <p className="text-sm text-fg-muted italic">
                          &ldquo;{concept}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {state.status !== 'idle' && (
                  <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
                    <GenerationProgress
                      state={state}
                      isLoading={isLoading}
                      enabledFields={enabledFields}
                      onGenerateField={handleRetryField}
                      onRegenerateField={handleRegenerateField}
                    />
                  </div>
                )}
              </div>

              {/* Right Panel - Preview */}
              {hasGeneratedContent && (
                <div className="space-y-6">
                  <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
                    <GeneratedCardPreview
                      generatedData={state.generatedData}
                      generatedReasoning={state.generatedReasoning}
                      enabledFields={enabledFields}
                      onFieldChange={updateGeneratedField}
                    />
                  </div>

                  {/* Save button area */}
                  {canSave && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveToVault}
                        disabled={isSaving || !state.generatedData.name}
                        className="flex items-center gap-2 px-6 py-2.5 bg-accent text-accent-fg font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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

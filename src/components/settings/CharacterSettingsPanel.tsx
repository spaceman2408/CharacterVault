/**
 * @fileoverview Character Settings Panel for AI configuration.
 * @module components/settings/CharacterSettingsPanel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Save,
  RefreshCw,
  Key,
  Server,
  Brain,
  Thermometer,
  Filter,
  Layers,
  Repeat,
  Check,
  AlertCircle,
  MessageSquare,
  Percent,
  Hash,
  Settings2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Loader2,
  Sparkles,
  Target,
  Sliders,
  Wand2,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import type { AIConfig, SamplerSettings, PromptSettings } from '../../db/types';
import { DEFAULT_SETTINGS } from '../../db/types';
import { characterSettingsService } from '../../services/CharacterSettingsService';
import { useCharacterEditorContext } from '../../context';
import { AIService, AIError } from '../../services/AIService';

interface CharacterSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

// Slider control component with value display
interface SliderControlProps {
  id: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  showWarning?: boolean;
  warningMessage?: string;
}

const SliderControl: React.FC<SliderControlProps> = ({
  id,
  label,
  icon,
  value,
  min,
  max,
  step,
  onChange,
  formatValue = (v) => v.toString(),
  showWarning = false,
  warningMessage = '',
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <label 
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium text-vault-700 dark:text-vault-300"
      >
        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
          {icon}
        </span>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-vault-200 dark:bg-vault-700 rounded-lg appearance-none cursor-pointer accent-vault-600 dark:accent-vault-400 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
          style={{
            background: `linear-gradient(to right, var(--color-vault-600) 0%, var(--color-vault-600) ${percentage}%, var(--color-vault-200) ${percentage}%, var(--color-vault-200) 100%)`,
          }}
        />
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-xs text-vault-500">{formatValue(min)}</span>
          <span className={`text-sm font-semibold ${showWarning ? 'text-amber-600 dark:text-amber-400' : 'text-vault-700 dark:text-vault-300'}`}>
            {formatValue(value)}
          </span>
          <span className="text-xs text-vault-500">{formatValue(max)}</span>
        </div>
        {showWarning && warningMessage && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{warningMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Sampler settings sub-component
interface SamplerSettingsSectionProps {
  settings: SamplerSettings;
  onChange: (settings: SamplerSettings) => void;
}

const SamplerSettingsSection: React.FC<SamplerSettingsSectionProps> = ({
  settings,
  onChange,
}) => {
  const handlePreset = (preset: 'creative' | 'balanced' | 'factual') => {
    const presets = {
      creative: { temperature: 0.9, minP: 0.05, topK: 50, repetitionPenalty: 1.05, topP: 0.95, contextLength: 4096, maxTokens: 2048 },
      balanced: { temperature: 0.7, minP: 0.05, topK: 40, repetitionPenalty: 1.1, topP: 1.0, contextLength: 4096, maxTokens: 2048 },
      factual: { temperature: 0.3, minP: 0.1, topK: 20, repetitionPenalty: 1.2, topP: 0.5, contextLength: 4096, maxTokens: 1024 },
    };
    onChange({ ...settings, ...presets[preset] });
  };

  const updateSetting = <K extends keyof SamplerSettings>(
    key: K,
    value: SamplerSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="bg-linear-to-br from-vault-50 to-vault-100 dark:from-vault-800/50 dark:to-vault-800 rounded-xl p-4 border border-vault-200 dark:border-vault-700">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <span className="text-sm font-semibold text-vault-700 dark:text-vault-300">
            Quick Presets
          </span>
        </div>
        <div className="flex gap-2">
          {(['creative', 'balanced', 'factual'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePreset(preset)}
              className="flex-1 px-3 py-2 text-sm font-medium bg-white dark:bg-vault-700 hover:bg-vault-50 dark:hover:bg-vault-600 text-vault-700 dark:text-vault-300 rounded-lg transition-all duration-200 border border-vault-200 dark:border-vault-600 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50"
            >
              <span className="capitalize">{preset}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Samplers */}
      <div className="bg-white dark:bg-vault-800/50 rounded-xl p-4 border border-vault-200 dark:border-vault-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <span className="text-sm font-semibold text-vault-700 dark:text-vault-300">
            Primary Samplers
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SliderControl
            id="temperature"
            label="Temperature"
            icon={<Thermometer className="w-4 h-4" />}
            value={settings.temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => updateSetting('temperature', v)}
            formatValue={(v) => v.toFixed(1)}
          />

          <SliderControl
            id="topP"
            label="Top P"
            icon={<Percent className="w-4 h-4" />}
            value={settings.topP}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateSetting('topP', v)}
            formatValue={(v) => v.toFixed(2)}
          />

          <SliderControl
            id="minP"
            label="Min P"
            icon={<Filter className="w-4 h-4" />}
            value={settings.minP}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updateSetting('minP', v)}
            formatValue={(v) => v.toFixed(2)}
          />

          <SliderControl
            id="topK"
            label="Top K"
            icon={<Layers className="w-4 h-4" />}
            value={settings.topK}
            min={1}
            max={100}
            step={1}
            onChange={(v) => updateSetting('topK', v)}
            formatValue={(v) => Math.round(v).toString()}
          />
        </div>
      </div>

      {/* Secondary Samplers */}
      <div className="bg-white dark:bg-vault-800/50 rounded-xl p-4 border border-vault-200 dark:border-vault-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-vault-600 dark:text-vault-400" />
          <span className="text-sm font-semibold text-vault-700 dark:text-vault-300">
            Secondary Samplers
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SliderControl
            id="repetitionPenalty"
            label="Repetition Penalty"
            icon={<Repeat className="w-4 h-4" />}
            value={settings.repetitionPenalty}
            min={1}
            max={2}
            step={0.05}
            onChange={(v) => updateSetting('repetitionPenalty', v)}
            formatValue={(v) => v.toFixed(2)}
          />

          <SliderControl
            id="maxTokens"
            label="Max Tokens"
            icon={<Hash className="w-4 h-4" />}
            value={settings.maxTokens}
            min={100}
            max={8192}
            step={100}
            onChange={(v) => updateSetting('maxTokens', Math.round(v))}
            formatValue={(v) => Math.round(v).toString()}
          />

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-vault-700 dark:text-vault-300 mb-2">
              <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                <BookOpen className="w-4 h-4" />
              </span>
              Context Length
            </label>
            <select
              value={settings.contextLength}
              onChange={(e) => updateSetting('contextLength', parseInt(e.target.value))}
              className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
            >
              <option value={2048}>2K tokens</option>
              <option value={4096}>4K tokens</option>
              <option value={8192}>8K tokens</option>
              <option value={16384}>16K tokens</option>
              <option value={32768}>32K tokens</option>
              <option value={65536}>64K tokens</option>
              <option value={128000}>128K tokens</option>
            </select>
            <p className="mt-2 text-xs text-vault-500">
              Maximum context window for AI requests
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Model selector with search
interface ModelSelectProps {
  models: Array<{ id: string; name: string }>;
  selectedModelId: string;
  onSelect: (modelId: string) => void;
  onFetch: () => void;
  isFetching: boolean;
  disabled?: boolean;
}

const ModelSelect: React.FC<ModelSelectProps> = ({
  models,
  selectedModelId,
  onSelect,
  onFetch,
  isFetching,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedModel = models.find(m => m.id === selectedModelId);

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opening and scroll into view
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      
      // Scroll the dropdown into view so all options are visible
      const scrollableParent = containerRef.current?.closest('.overflow-y-auto');
      if (scrollableParent && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = scrollableParent.getBoundingClientRect();
        const dropdownHeight = 256; // max-h-64 = 16rem = 256px
        
        // Check if dropdown would extend beyond visible area
        const spaceBelow = parentRect.bottom - containerRect.bottom;
        if (spaceBelow < dropdownHeight) {
          // Calculate how much we need to scroll to show the full dropdown
          const scrollNeeded = dropdownHeight - spaceBelow + 16; // 16px padding
          scrollableParent.scrollTo({
            top: scrollableParent.scrollTop + scrollNeeded,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [isOpen]);

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredModels.length > 0) {
      handleSelect(filteredModels[0].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200">
        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
          <Brain className="w-4 h-4" />
        </span>
        Model
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          {/* Display/Search Input */}
          <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={`w-full px-3 py-2.5 border rounded-lg text-left transition-all duration-200 flex items-center justify-between ${
              disabled
                ? 'bg-vault-100 dark:bg-vault-800 text-vault-400 cursor-not-allowed border-vault-200 dark:border-vault-700'
                : 'bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 border-vault-300 dark:border-vault-600 hover:border-vault-400 dark:hover:border-vault-500 focus:outline-none focus:ring-2 focus:ring-vault-500/50'
            }`}
          >
            <span className={selectedModelId ? 'font-medium' : 'text-vault-400'}>
              {selectedModel?.name || 'Select or type to search models...'}
            </span>
            <ChevronDown className={`w-4 h-4 text-vault-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-vault-800 border border-vault-300 dark:border-vault-600 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
              {/* Search Input */}
              <div className="p-2 border-b border-vault-200 dark:border-vault-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vault-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type to filter models..."
                    className="w-full pl-9 pr-3 py-2 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50"
                  />
                </div>
              </div>

              {/* Model List */}
              <div className="overflow-y-auto max-h-48">
                {filteredModels.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-vault-500 text-center">
                    No models found matching &quot;{searchTerm}&quot;
                  </div>
                ) : (
                  filteredModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleSelect(model.id)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors duration-150 ${
                        model.id === selectedModelId
                          ? 'bg-vault-100 dark:bg-vault-700 text-vault-900 dark:text-vault-100 font-medium'
                          : 'text-vault-700 dark:text-vault-300 hover:bg-vault-50 dark:hover:bg-vault-700/50'
                      }`}
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-vault-500 truncate">{model.id}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onFetch}
          disabled={isFetching || disabled}
          className="px-4 py-2 bg-vault-100 dark:bg-vault-800 hover:bg-vault-200 dark:hover:bg-vault-700 disabled:opacity-50 disabled:cursor-not-allowed text-vault-700 dark:text-vault-300 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-vault-500/50"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Fetch
        </button>
      </div>
    </div>
  );
};

// Toast notification component
const ToastContainer: React.FC<{
  toasts: ToastNotification[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-100 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-in slide-in-from-right ${
            toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-2 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export function CharacterSettingsPanel({ isOpen, onClose }: CharacterSettingsPanelProps): React.ReactElement | null {
  const { reloadSettings } = useCharacterEditorContext();

  // Animation state for smooth fade in/out
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  // Local state for editing - initialize with defaults
  const [localAIConfig, setLocalAIConfig] = useState<AIConfig>({
    baseUrl: 'https://nano-gpt.com/api/v1',
    apiKey: '',
    modelId: '',
    availableModels: [],
    enableStreaming: false,
    enableReasoning: false,
    showReasoning: false,
  });
  const [localSampler, setLocalSampler] = useState<SamplerSettings>({
    temperature: 0.7,
    minP: 0.05,
    topK: 40,
    repetitionPenalty: 1.1,
    topP: 1.0,
    contextLength: 4096,
    maxTokens: 2048,
  });
  const [localPrompts, setLocalPrompts] = useState<PromptSettings>(DEFAULT_SETTINGS.prompts);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'ai' | 'sampler' | 'prompts'>('ai');
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toastTimeoutsRef = useRef<number[]>([]);

  // Add toast notification
  const addToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
    const timeoutId = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
    toastTimeoutsRef.current.push(timeoutId);
  }, []);

  // Remove toast
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Reset transient toast UI when panel closes.
  useEffect(() => {
    if (isOpen) return;

    setToasts([]);
    toastTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    toastTimeoutsRef.current = [];
  }, [isOpen]);

  // Cleanup timeouts on unmount.
  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
      toastTimeoutsRef.current = [];
    };
  }, []);

  // Load settings when panel opens
  useEffect(() => {
    if (!isOpen) return;
    
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [config, sampler, prompts] = await Promise.all([
          characterSettingsService.getAISettings(),
          characterSettingsService.getSamplerSettings(),
          characterSettingsService.getPromptSettings(),
        ]);
        
        setLocalAIConfig(prev => ({ ...prev, ...config }));
        setLocalSampler({
          temperature: sampler?.temperature ?? 0.7,
          minP: sampler?.minP ?? 0.05,
          topK: sampler?.topK ?? 40,
          repetitionPenalty: sampler?.repetitionPenalty ?? 1.1,
          topP: sampler?.topP ?? 1.0,
          contextLength: sampler?.contextLength ?? 4096,
          maxTokens: Math.min(sampler?.maxTokens ?? 2048, 8192), // Clamp on load
        });
        setLocalPrompts(prompts);
      } catch (err) {
        console.error('Failed to load settings:', err);
        addToast('error', 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    
    void loadSettings();
  }, [isOpen, addToast]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Tab navigation between tabs
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const tabs: ('ai' | 'sampler' | 'prompts')[] = ['ai', 'sampler', 'prompts'];
        const currentIndex = tabs.indexOf(activeTab);
        let newIndex: number;
        
        if (e.key === 'ArrowLeft') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        } else {
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        }
        
        setActiveTab(tabs[newIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, onClose, addToast]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    
    const panel = panelRef.current;
    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen, activeTab]);

  // Handle open/close with fade animation
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Small delay to allow render before starting fade-in
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      // Wait for fade-out transition before unmounting
      setTimeout(() => setIsRendered(false), 300);
    }
  }, [isOpen]);

  // Fetch available models
  const fetchModels = async () => {
    setIsFetchingModels(true);

    try {
      const aiService = new AIService(localAIConfig, localSampler);
      const models = await aiService.fetchModels();
      setLocalAIConfig(prev => ({ ...prev, availableModels: models }));
      addToast('success', `Fetched ${models.length} models`);
    } catch (err) {
      if (err instanceof AIError) {
        addToast('error', err.message);
      } else {
        addToast('error', 'Failed to fetch models');
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Validate prompts
  const validatePrompts = (): string | null => {
    const errors: string[] = [];

    if (!localPrompts.expand.includes('${text}')) {
      errors.push('Expand prompt must contain ${text}');
    }
    if (!localPrompts.rewrite.includes('${text}')) {
      errors.push('Rewrite prompt must contain ${text}');
    }

    if (!localPrompts.instruct.includes('${text}')) {
      errors.push('Instruct prompt must contain ${text}');
    }
    if (!localPrompts.instruct.includes('${instruction}')) {
      errors.push('Instruct prompt must contain ${instruction}');
    }

    const polishPrompts = ['shorten', 'lengthen', 'vivid', 'emotion', 'grammar'] as const;
    for (const promptType of polishPrompts) {
      if (!localPrompts[promptType].includes('${text}')) {
        errors.push(`${promptType.charAt(0).toUpperCase() + promptType.slice(1)} prompt must contain \${text}`);
      }
    }

    return errors.length > 0 ? errors.join('\n') : null;
  };

  // Save all settings
  const handleSave = async () => {
    setIsSaving(true);

    const validationError = validatePrompts();
    if (validationError) {
      addToast('error', validationError);
      setIsSaving(false);
      return;
    }

    try {
      // Clamp max tokens before saving
      const clampedSampler = {
        ...localSampler,
        maxTokens: Math.min(localSampler.maxTokens, 8192),
      };

      await characterSettingsService.saveAllAISettings(
        localAIConfig,
        clampedSampler,
        localPrompts
      );
      
      await reloadSettings();
      
      addToast('success', 'Settings saved successfully!');
    } catch {
      addToast('error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Clear AI settings
  const handleClearAISettings = async () => {
    setIsClearing(true);
    try {
      await characterSettingsService.clearAISettings();
      
      // Reset local state to defaults
      setLocalAIConfig({
        baseUrl: 'https://nano-gpt.com/api/v1',
        apiKey: '',
        modelId: '',
        availableModels: [],
        enableStreaming: false,
        enableReasoning: false,
        showReasoning: false,
      });
      
      await reloadSettings();
      addToast('success', 'AI settings cleared. Your characters are safe.');
      setShowClearConfirm(false);
    } catch {
      addToast('error', 'Failed to clear AI settings');
    } finally {
      setIsClearing(false);
    }
  };

  // Don't render if not yet visible (allows fade-in animation)
  if (!isRendered) return null;

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div 
          ref={panelRef}
          className={`bg-vault-50 dark:bg-vault-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-vault-200 dark:ring-vault-800 transition-transform duration-300 scale-100 ${
            isVisible ? 'scale-100' : 'scale-95'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-vault-200 dark:border-vault-800 bg-white dark:bg-vault-900">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-linear-to-br from-vault-500 to-vault-600">
                <Settings2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 
                  id="settings-title"
                  className="text-lg font-bold text-vault-900 dark:text-vault-100"
                >
                  AI Settings
                </h2>
                <p className="text-xs text-vault-500">Configure your AI generation preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-vault-500 hover:text-vault-700 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
              aria-label="Close settings panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-vault-200 dark:border-vault-800 px-6 bg-vault-50 dark:bg-vault-900/50">
            {(['ai', 'sampler', 'prompts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize transition-all duration-200 border-b-2 -mb-px focus:outline-none focus:ring-2 focus:ring-vault-500/50 focus:ring-inset ${
                  activeTab === tab
                    ? 'border-vault-600 text-vault-600 dark:border-vault-400 dark:text-vault-400'
                    : 'border-transparent text-vault-500 dark:text-vault-400 hover:text-vault-700 dark:hover:text-vault-300 hover:bg-vault-100/50 dark:hover:bg-vault-800/50'
                }`}
                aria-selected={activeTab === tab}
                role="tab"
              >
                <span className="flex items-center gap-2">
                  {tab === 'ai' && <Brain className="w-4 h-4" />}
                  {tab === 'sampler' && <Sliders className="w-4 h-4" />}
                  {tab === 'prompts' && <MessageSquare className="w-4 h-4" />}
                  {tab === 'ai' ? 'AI Config' : tab}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-vault-50/50 dark:bg-vault-900/50">
            {isLoading && activeTab !== 'sampler' && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-vault-600" />
                  <span className="text-sm text-vault-500">Loading settings...</span>
                </div>
              </div>
            )}

            {/* AI Config Tab */}
            {activeTab === 'ai' && !isLoading && (
              <div className="space-y-5">
                {/* Security Warning Banner */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400 shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                        Security Notice
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                        Your API key is stored locally in your browser's IndexedDB.
                        This is convenient but means the key could be accessed by malicious
                        browser extensions or if someone gains physical access to your unlocked computer.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear AI Settings
                        </button>
                        <span className="text-xs text-amber-600 dark:text-amber-500">
                          (Your characters will not be affected)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clear Confirmation Dialog */}
                {showClearConfirm && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400 shrink-0">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                          Clear AI Settings?
                        </h4>
                        <p className="text-xs text-red-700 dark:text-red-400 mb-3">
                          This will remove your API key, base URL, and model selection.
                          Your characters and other data will remain untouched.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleClearAISettings}
                            disabled={isClearing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          >
                            {isClearing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            {isClearing ? 'Clearing...' : 'Yes, Clear Settings'}
                          </button>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            disabled={isClearing}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-vault-800/50 rounded-xl p-5 border border-vault-200 dark:border-vault-700 shadow-sm">
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200 mb-2">
                        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                          <Server className="w-4 h-4" />
                        </span>
                        API Base URL
                      </label>
                      <input
                        type="text"
                        value={localAIConfig.baseUrl}
                        onChange={(e) => setLocalAIConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
                        placeholder="https://nano-gpt.com/api/v1"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-vault-800 dark:text-vault-200 mb-2">
                        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                          <Key className="w-4 h-4" />
                        </span>
                        API Key
                      </label>
                      <input
                        type="password"
                        value={localAIConfig.apiKey}
                        onChange={(e) => setLocalAIConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
                        placeholder="Enter your API key"
                      />
                    </div>

                    <ModelSelect
                      models={localAIConfig.availableModels || []}
                      selectedModelId={localAIConfig.modelId}
                      onSelect={(modelId) => setLocalAIConfig(prev => ({ ...prev, modelId }))}
                      onFetch={fetchModels}
                      isFetching={isFetchingModels}
                      disabled={false}
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-vault-800/50 rounded-xl p-5 border border-vault-200 dark:border-vault-700 shadow-sm">
                  <h3 className="text-sm font-semibold text-vault-800 dark:text-vault-200 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-vault-600 dark:text-vault-400" />
                    Advanced Options
                  </h3>
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-3 text-sm text-vault-700 dark:text-vault-300 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={localAIConfig.enableStreaming}
                          onChange={(e) => setLocalAIConfig(prev => ({ ...prev, enableStreaming: e.target.checked }))}
                          className="peer sr-only"
                        />
                        <div className="w-10 h-6 bg-vault-300 dark:bg-vault-700 rounded-full peer-checked:bg-vault-600 dark:peer-checked:bg-vault-500 transition-colors duration-200" />
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4" />
                      </div>
                      <span className="group-hover:text-vault-900 dark:group-hover:text-vault-100 transition-colors">Enable streaming</span>
                    </label>

                    <label className="flex items-center gap-3 text-sm text-vault-700 dark:text-vault-300 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={localAIConfig.enableReasoning}
                          onChange={(e) => setLocalAIConfig(prev => ({ ...prev, enableReasoning: e.target.checked }))}
                          className="peer sr-only"
                        />
                        <div className="w-10 h-6 bg-vault-300 dark:bg-vault-700 rounded-full peer-checked:bg-vault-600 dark:peer-checked:bg-vault-500 transition-colors duration-200" />
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4" />
                      </div>
                      <span className="group-hover:text-vault-900 dark:group-hover:text-vault-100 transition-colors">Enable reasoning</span>
                    </label>
                    <label className="flex items-center gap-3 text-sm text-vault-700 dark:text-vault-300 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={localAIConfig.showReasoning !== false}
                          onChange={(e) => setLocalAIConfig(prev => ({ ...prev, showReasoning: e.target.checked }))}
                          className="peer sr-only"
                        />
                        <div className="w-10 h-6 bg-vault-300 dark:bg-vault-700 rounded-full peer-checked:bg-vault-600 dark:peer-checked:bg-vault-500 transition-colors duration-200" />
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4" />
                      </div>
                      <span className="group-hover:text-vault-900 dark:group-hover:text-vault-100 transition-colors">Show reasoning</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Sampler Tab */}
            {activeTab === 'sampler' && (
              <SamplerSettingsSection
                settings={localSampler}
                onChange={setLocalSampler}
              />
            )}

            {/* Prompts Tab */}
            {activeTab === 'prompts' && !isLoading && (
              <div className="space-y-4">
                {/* Primary Operations */}
                <div className="bg-white dark:bg-vault-800/50 rounded-xl p-4 border border-vault-200 dark:border-vault-700 shadow-sm">
                  <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Primary Operations
                  </h3>
                  {(['expand', 'rewrite', 'instruct'] as const).map((promptType) => (
                    <div key={promptType} className="border border-vault-200 dark:border-vault-700 rounded-lg overflow-hidden mb-3 last:mb-0">
                      <button
                        onClick={() => setExpandedPrompts(prev => ({ ...prev, [promptType]: !prev[promptType] }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-vault-50 dark:bg-vault-800/50 hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-vault-700 dark:text-vault-300 capitalize">
                          <MessageSquare className="w-4 h-4 text-vault-500" />
                          {promptType === 'expand' ? 'Enhance' : promptType === 'rewrite' ? 'Rephrase' : 'Custom'} Prompt
                        </span>
                        {expandedPrompts[promptType] ? (
                          <ChevronUp className="w-4 h-4 text-vault-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-vault-500" />
                        )}
                      </button>
                      {expandedPrompts[promptType] && (
                        <div className="p-4">
                          <textarea
                            value={localPrompts[promptType]}
                            onChange={(e) => setLocalPrompts(prev => ({ ...prev, [promptType]: e.target.value }))}
                            className="w-full h-32 px-3 py-2 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 resize-none transition-all duration-200"
                            placeholder={`Enter ${promptType} prompt...`}
                          />
                          <div className="mt-2 text-xs space-y-1">
                            {promptType === 'instruct' ? (
                              <span className="text-vault-600 dark:text-vault-400">
                                <span className="font-semibold text-red-500">Required:</span> Must contain ${'{text}'} and ${'{instruction}'}
                              </span>
                            ) : (
                              <span className="text-vault-600 dark:text-vault-400">
                                <span className="font-semibold text-red-500">Required:</span> Must contain ${'{text}'}
                              </span>
                            )}
                          </div>
                          {!localPrompts[promptType].includes('${text}') && (
                            <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Missing required ${'{text}'} placeholder!
                            </p>
                          )}
                          {promptType === 'instruct' && !localPrompts[promptType].includes('${instruction}') && (
                            <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Missing required ${'{instruction}'} placeholder!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Polish Operations */}
                <div className="bg-white dark:bg-vault-800/50 rounded-xl p-4 border border-vault-200 dark:border-vault-700 shadow-sm">
                  <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Polish Operations (More Menu)
                  </h3>
                  {(['shorten', 'lengthen', 'vivid', 'emotion', 'grammar'] as const).map((promptType) => (
                    <div key={promptType} className="border border-vault-200 dark:border-vault-700 rounded-lg overflow-hidden mb-3 last:mb-0">
                      <button
                        onClick={() => setExpandedPrompts(prev => ({ ...prev, [promptType]: !prev[promptType] }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-vault-50 dark:bg-vault-800/50 hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-vault-700 dark:text-vault-300 capitalize">
                          <MessageSquare className="w-4 h-4 text-vault-500" />
                          {promptType === 'grammar' ? 'Fix' : promptType} Prompt
                        </span>
                        {expandedPrompts[promptType] ? (
                          <ChevronUp className="w-4 h-4 text-vault-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-vault-500" />
                        )}
                      </button>
                      {expandedPrompts[promptType] && (
                        <div className="p-4">
                          <textarea
                            value={localPrompts[promptType]}
                            onChange={(e) => setLocalPrompts(prev => ({ ...prev, [promptType]: e.target.value }))}
                            className="w-full h-32 px-3 py-2 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm focus:outline-none focus:ring-2 focus:ring-vault-500/50 resize-none transition-all duration-200"
                            placeholder={`Enter ${promptType} prompt...`}
                          />
                          <div className="mt-2 text-xs">
                            <span className="text-vault-600 dark:text-vault-400">
                              <span className="font-semibold text-red-500">Required:</span> Must contain ${'{text}'}
                            </span>
                          </div>
                          {!localPrompts[promptType].includes('${text}') && (
                            <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Missing required ${'{text}'} placeholder!
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-vault-200 dark:border-vault-800 bg-white dark:bg-vault-900">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-vault-700 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-vault-600 to-vault-700 hover:from-vault-700 hover:to-vault-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default CharacterSettingsPanel;

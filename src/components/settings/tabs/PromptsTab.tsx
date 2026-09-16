/**
 * @fileoverview Custom AI operation prompts tab.
 * @module components/settings/tabs/PromptsTab
 */

import React, { useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Bot, ChevronDown, ChevronUp, Lock, MessageSquare, Plus, RotateCcw, SlidersHorizontal, Sparkles, Target, Trash2 } from 'lucide-react';
import type { CustomToolbarOp, PromptModelBinding, PromptSettings, ToolbarConfig } from '../../../db/characterTypes';
import { DEFAULT_CUSTOM_BUTTON_COLOR, TOOLBAR_COLOR_PALETTE, normalizeToolbarConfig } from '../../../db/characterTypes';
import {
  BUILTIN_TOOLBAR_BUTTONS,
  TOOLBAR_ICON_PALETTE,
  createCustomOpId,
  moveToolbarOp,
  prunePromptModelsForToolbar,
  removeToolbarOps,
  resolveToolbarButtons,
  validateCustomOp,
} from '../../../services/toolbarConfig';
import { SettingsCard } from '../components/SettingsCard';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { PromptModelBindingSelect } from '../components/PromptModelBindingSelect';
import type { SettingsTabProps } from '../types';

const PRIMARY_PROMPTS = ['expand', 'rewrite', 'instruct'] as const;
const POLISH_PROMPTS = ['shorten', 'lengthen', 'vivid', 'emotion', 'grammar'] as const;

function promptLabel(promptType: keyof PromptSettings): string {
  if (promptType === 'expand') return 'Enhance Prompt';
  if (promptType === 'rewrite') return 'Rephrase Prompt';
  if (promptType === 'instruct') return 'Custom Prompt';
  if (promptType === 'grammar') return 'Fix Prompt';
  return `${promptType.charAt(0).toUpperCase() + promptType.slice(1)} Prompt`;
}

interface PromptEditorProps {
  promptType: keyof PromptSettings;
  value: string;
  binding: PromptModelBinding | undefined;
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onBindingChange: (binding: PromptModelBinding | undefined) => void;
  helpers: SettingsTabProps['helpers'];
  globalAi: SettingsTabProps['draft']['ai'];
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  promptType,
  value,
  binding,
  expanded,
  onToggle,
  onChange,
  onBindingChange,
  helpers,
  globalAi,
}) => {
  const endpoint = binding?.baseUrl ?? '';
  const isFetching =
    !!helpers && endpoint
      ? helpers.isFetchingModelsForUrl(endpoint)
      : false;

  return (
    <div className="border border-border rounded-lg mb-3 last:mb-0 overflow-visible">
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-h-12 flex items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-muted hover:bg-hover active:bg-hover transition-colors rounded-t-lg text-left"
      >
        <span className="flex items-start sm:items-center gap-2 text-sm font-semibold text-fg-muted min-w-0">
          <MessageSquare className="w-4 h-4 text-fg-muted shrink-0 mt-0.5 sm:mt-0" />
          <span className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="capitalize truncate">{promptLabel(promptType)}</span>
            {binding?.modelId && (
              <span className="normal-case font-normal text-xs text-fg-muted truncate max-w-full sm:max-w-[14rem]">
                → {binding.modelId}
              </span>
            )}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-fg-muted shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-fg-muted shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="p-3 sm:p-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-28 h-32 px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y transition-all duration-200"
            placeholder={`Enter ${promptType} prompt...`}
          />
          <div className="mt-2 text-xs space-y-1">
            {promptType === 'instruct' ? (
              <span className="text-fg-muted">
                <span className="font-semibold text-danger">Required:</span> Must contain ${'{text}'}{' '}
                and ${'{instruction}'}
              </span>
            ) : (
              <span className="text-fg-muted">
                <span className="font-semibold text-danger">Required:</span> Must contain ${'{text}'}
              </span>
            )}
          </div>
          {!value.includes('${text}') && (
            <p className="mt-2 text-xs text-danger flex items-start gap-1">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              Missing required ${'{text}'} placeholder!
            </p>
          )}
          {promptType === 'instruct' && !value.includes('${instruction}') && (
            <p className="mt-2 text-xs text-danger flex items-start gap-1">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              Missing required ${'{instruction}'} placeholder!
            </p>
          )}

          {helpers && (
            <PromptModelBindingSelect
              binding={binding}
              globalAi={globalAi}
              modelsByBaseUrl={helpers.modelsByBaseUrl}
              onChange={onBindingChange}
              onFetch={helpers.fetchModelsForUrl}
              isFetching={isFetching}
            />
          )}
        </div>
      )}
    </div>
  );
};

const ColorSelect: React.FC<{ value: string; onChange: (color: string) => void; label: string }> = ({
  value,
  onChange,
  label,
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={label}
    title={label}
    style={{ color: value }}
    className="px-3 py-2 border border-border-strong rounded-lg bg-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50"
  >
    {TOOLBAR_COLOR_PALETTE.map((entry) => (
      <option key={entry.value} value={entry.value} style={{ color: entry.value }}>
        ● {entry.label}
      </option>
    ))}
  </select>
);

const ToolbarButtonsSection: React.FC<{
  draft: SettingsTabProps['draft'];
  setDraft: SettingsTabProps['setDraft'];
  helpers: SettingsTabProps['helpers'];
  globalAi: SettingsTabProps['draft']['ai'];
}> = ({ draft, setDraft, helpers, globalAi }) => {
  const toolbar = normalizeToolbarConfig(draft.toolbar);
  const buttons = resolveToolbarButtons(toolbar);
  const [expandedCustom, setExpandedCustom] = useState<Record<string, boolean>>({});
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState(TOOLBAR_ICON_PALETTE[0]);
  const [newColor, setNewColor] = useState(DEFAULT_CUSTOM_BUTTON_COLOR);
  const [newPrompt, setNewPrompt] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingBulk, setPendingBulk] = useState(false);

  const setToolbar = (next: ToolbarConfig) => {
    setDraft((prev) => ({ ...prev, toolbar: next }));
  };

  const setOpBinding = (key: string, binding: PromptModelBinding | undefined) => {
    setDraft((prev) => {
      const next = { ...prev.promptModels };
      if (!binding) {
        delete next[key];
      } else {
        next[key] = binding;
      }
      return { ...prev, promptModels: next };
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = toolbar.order.indexOf(id);
    setToolbar({ ...toolbar, order: moveToolbarOp(toolbar.order, id, idx + dir) });
  };

  const hide = (id: string) => {
    if (id === 'instruct') return;
    setToolbar({ ...toolbar, order: toolbar.order.filter((entry) => entry !== id) });
    setSelectedIds((prev) => prev.filter((entry) => entry !== id));
  };

  const addBuiltin = (id: string) => {
    setToolbar(normalizeToolbarConfig({ ...toolbar, order: [...toolbar.order, id] }));
  };

  const deleteCustom = (id: string) => {
    setToolbar({
      order: toolbar.order.filter((entry) => entry !== id),
      customOps: toolbar.customOps.filter((op) => op.id !== id),
    });
    setOpBinding(id, undefined);
    setSelectedIds((prev) => prev.filter((entry) => entry !== id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds([]);
  };

  const confirmBulkRemove = () => {
    const removedCustomIds = new Set(
      toolbar.customOps.filter((op) => selectedIds.includes(op.id)).map((op) => op.id),
    );
    setDraft((prev) => {
      const nextModels = { ...prev.promptModels };
      for (const id of removedCustomIds) delete nextModels[id];
      return {
        ...prev,
        toolbar: removeToolbarOps(prev.toolbar, selectedIds),
        promptModels: nextModels,
      };
    });
    setSelectedIds([]);
    setBulkMode(false);
    setPendingBulk(false);
  };

  const patchCustom = (id: string, patch: Partial<CustomToolbarOp>) => {
    setToolbar({
      ...toolbar,
      customOps: toolbar.customOps.map((op) => (op.id === id ? { ...op, ...patch } : op)),
    });
  };

  const addCustom = () => {
    const err = validateCustomOp(
      { label: newLabel, prompt: newPrompt },
      buttons.map((b) => b.label),
    );
    if (err) {
      setNewError(err);
      return;
    }
    const id = createCustomOpId();
    setToolbar({
      order: [...toolbar.order, id],
      customOps: [
        ...toolbar.customOps,
        { id, label: newLabel.trim(), icon: newIcon, color: newColor, prompt: newPrompt },
      ],
    });
    setExpandedCustom((prev) => ({ ...prev, [id]: true }));
    setNewLabel('');
    setNewColor(DEFAULT_CUSTOM_BUTTON_COLOR);
    setNewIcon(TOOLBAR_ICON_PALETTE[0]);
    setNewPrompt('');
    setNewError(null);
  };

  const hiddenBuiltins = (Object.keys(BUILTIN_TOOLBAR_BUTTONS) as string[]).filter(
    (id) => !toolbar.order.includes(id),
  );
  const selectableCount = buttons.filter((b) => b.id !== 'instruct').length;
  const selectedButtons = buttons.filter((b) => selectedIds.includes(b.id));
  const selectedCustoms = selectedButtons.filter((b) => b.isCustom);
  const selectedBuiltins = selectedButtons.filter((b) => !b.isCustom);

  return (
    <SettingsCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          Toolbar Buttons
        </h3>
        {selectableCount > 0 && (
          <button
            type="button"
            onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            {bulkMode ? 'Done' : 'Select'}
          </button>
        )}
      </div>
      <p className="text-xs text-fg-muted mb-3">
        Order the buttons left to right. Extras collapse into the More menu on narrow screens.
        Custom is always kept.
      </p>
      {buttons.map((def, index) => {
        const isLocked = def.id === 'instruct';
        const custom = def.isCustom
          ? toolbar.customOps.find((op) => op.id === def.id)
          : undefined;
        const expanded = !!expandedCustom[def.id];
        const toggleEdit = () =>
          setExpandedCustom((prev) => ({ ...prev, [def.id]: !prev[def.id] }));
        return (
          <div
            key={def.id}
            className={`border rounded-lg mb-2 last:mb-0 overflow-visible transition-colors ${
              expanded ? 'border-accent/60' : 'border-border'
            }`}
          >
            <div className="w-full min-h-12 flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-muted rounded-t-lg">
              {bulkMode && !isLocked ? (
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(def.id)}
                    onChange={() => toggleSelect(def.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="text-base leading-none" aria-hidden="true">{def.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-muted">
                    {def.label}
                  </span>
                </label>
              ) : (
                <>
                  <span className="text-base leading-none" aria-hidden="true">{def.icon}</span>
                  {custom ? (
                    <button
                      type="button"
                      onClick={toggleEdit}
                      title={expanded ? 'Finish editing' : 'Edit button'}
                      className="flex-1 min-w-0 truncate text-left text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
                    >
                      {def.label}
                    </button>
                  ) : (
                    <span className="text-sm font-semibold text-fg-muted truncate flex-1 min-w-0">
                      {def.label}
                    </span>
                  )}
                </>
              )}
              {def.isCustom && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent shrink-0">
                  Custom
                </span>
              )}
              {custom && !bulkMode && (
                <button
                  type="button"
                  onClick={toggleEdit}
                  className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  {expanded ? 'Done' : 'Edit'}
                </button>
              )}
              {!bulkMode && (
                <>
                  <button
                    type="button"
                    onClick={() => move(def.id, -1)}
                    disabled={index === 0}
                    title="Move left"
                    className="p-1.5 rounded-md text-fg-muted hover:bg-hover disabled:opacity-30"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(def.id, 1)}
                    disabled={index === buttons.length - 1}
                    title="Move right"
                    className="p-1.5 rounded-md text-fg-muted hover:bg-hover disabled:opacity-30"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </>
              )}
              {isLocked ? (
                <span
                  title="Always kept on the toolbar"
                  className="inline-flex shrink-0 p-1.5"
                >
                  <Lock className="w-4 h-4 text-fg-muted" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(def.id)}
                  title={def.isCustom ? 'Delete button' : 'Remove from toolbar'}
                  className="p-1.5 rounded-md text-fg-muted hover:bg-hover hover:text-danger"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {custom && expanded && (
              <div className="p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <label className="flex flex-col gap-1 min-w-32 flex-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                      Label
                    </span>
                    <input
                      value={custom.label}
                      onChange={(e) => patchCustom(custom.id, { label: e.target.value })}
                      maxLength={40}
                      className="px-3 py-2 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                      Icon
                    </span>
                    <select
                      value={custom.icon}
                      onChange={(e) => patchCustom(custom.id, { icon: e.target.value })}
                      className="px-3 py-2 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                    >
                      {TOOLBAR_ICON_PALETTE.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                    Color
                  </span>
                  <ColorSelect
                    value={custom.color}
                    onChange={(color) => patchCustom(custom.id, { color })}
                    label="Button color"
                  />
                </div>
                <div>
                  <textarea
                    value={custom.prompt}
                    onChange={(e) => patchCustom(custom.id, { prompt: e.target.value })}
                    className="w-full min-h-28 h-32 px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y transition-all duration-200"
                    placeholder="Enter custom prompt..."
                  />
                  <div className="mt-2 text-xs space-y-1">
                    <span className="text-fg-muted">
                      <span className="font-semibold text-danger">Required:</span> Must contain
                      {'${text}'}
                    </span>
                  </div>
                  {!custom.prompt.includes('${text}') && (
                    <p className="mt-2 text-xs text-danger flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      Missing required {'${text}'} placeholder!
                    </p>
                  )}
                </div>
                {helpers && (
                  <PromptModelBindingSelect
                    binding={draft.promptModels[custom.id]}
                    globalAi={globalAi}
                    modelsByBaseUrl={helpers.modelsByBaseUrl}
                    onChange={(b) => setOpBinding(custom.id, b)}
                    onFetch={helpers.fetchModelsForUrl}
                    isFetching={(() => {
                      const endpoint = draft.promptModels[custom.id]?.baseUrl ?? '';
                      return !!endpoint && helpers.isFetchingModelsForUrl(endpoint);
                    })()}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      {bulkMode && (
        <div className="mt-1 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-fg-muted">
            {selectedIds.length === 0
              ? 'Tick buttons to remove'
              : `${selectedIds.length} selected`}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={exitBulkMode}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setPendingBulk(true)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40 ${
              selectedCustoms.length > 0
                ? 'border border-danger/40 bg-danger text-white hover:opacity-90'
                : 'bg-accent text-accent-fg hover:opacity-90'
            }`}
          >
            {selectedCustoms.length > 0
              ? `Delete (${selectedIds.length})`
              : `Remove (${selectedIds.length})`}
          </button>
        </div>
      )}
      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          Add buttons
        </div>
        {hiddenBuiltins.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {hiddenBuiltins.map((id) => {
              const builtin = BUILTIN_TOOLBAR_BUTTONS[id as keyof typeof BUILTIN_TOOLBAR_BUTTONS];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => addBuiltin(id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-hover hover:text-fg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {builtin.icon} {builtin.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-fg-muted mb-3">All built-in buttons are on the toolbar.</p>
        )}
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          New custom button
        </div>
        <div className="flex flex-wrap items-end gap-2 mb-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={40}
            placeholder="Label"
            aria-label="Button label"
            className="px-3 py-2 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 min-w-32 flex-1"
          />
          <select
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            title="Icon"
            aria-label="Button icon"
            className="px-3 py-2 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {TOOLBAR_ICON_PALETTE.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
          <ColorSelect value={newColor} onChange={setNewColor} label="Button color" />
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        <textarea
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          rows={2}
          placeholder="Prompt template: must contain ${text}"
          className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
        />
        {newError && (
          <p className="mt-2 text-xs text-danger flex items-start gap-1">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            {newError}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setPendingReset(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset toolbar to defaults
      </button>
      <ConfirmDialog
        open={pendingReset}
        title="Reset toolbar to defaults?"
        message="Your button order and all custom buttons will be replaced with the defaults. This cannot be undone."
        confirmLabel="Reset"
        variant="danger"
        onConfirm={() => {
          const next = normalizeToolbarConfig(undefined);
          setToolbar(next);
          setDraft((prev) => ({
            ...prev,
            promptModels: prunePromptModelsForToolbar(prev.promptModels, next),
          }));
          setPendingReset(false);
        }}
        onCancel={() => setPendingReset(false)}
      />
      {(() => {
        if (!pendingBulk || selectedButtons.length === 0) return null;
        const hasCustoms = selectedCustoms.length > 0;
        const names = (list: typeof selectedButtons) => {
          const quoted = list.map((b) => `"${b.label}"`);
          return quoted.length <= 3
            ? quoted.join(', ')
            : `${quoted.slice(0, 2).join(', ')} and ${quoted.length - 2} others`;
        };
        const parts: string[] = [];
        if (selectedCustoms.length > 0) {
          parts.push(`${names(selectedCustoms)} will be permanently deleted.`);
        }
        if (selectedBuiltins.length > 0) {
          parts.push(`${names(selectedBuiltins)} will be removed and can be re-added below.`);
        }
        return (
          <ConfirmDialog
            open
            title={
              hasCustoms
                ? `Delete ${selectedButtons.length} buttons?`
                : `Remove ${selectedButtons.length} buttons?`
            }
            message={parts.join(' ')}
            confirmLabel={hasCustoms ? 'Delete' : 'Remove'}
            variant={hasCustoms ? 'danger' : 'default'}
            onConfirm={confirmBulkRemove}
            onCancel={() => setPendingBulk(false)}
          />
        );
      })()}
      {(() => {
        const pending = buttons.find((b) => b.id === pendingDeleteId);
        if (!pending) return null;
        return (
          <ConfirmDialog
            open
            title={pending.isCustom ? `Delete "${pending.label}"?` : `Remove "${pending.label}"?`}
            message={
              pending.isCustom
                ? 'The button and its prompt template will be removed. This cannot be undone.'
                : 'You can re-add it under Add buttons below.'
            }
            confirmLabel={pending.isCustom ? 'Delete' : 'Remove'}
            variant={pending.isCustom ? 'danger' : 'default'}
            onConfirm={() => {
              if (pending.isCustom) deleteCustom(pending.id);
              else hide(pending.id);
              setPendingDeleteId(null);
            }}
            onCancel={() => setPendingDeleteId(null)}
          />
        );
      })()}
    </SettingsCard>
  );
};

export const PromptsTab: React.FC<SettingsTabProps> = ({ draft, setDraft, helpers }) => {
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});

  const setPrompt = (key: keyof PromptSettings, value: string) => {
    setDraft((prev) => ({
      ...prev,
      prompts: { ...prev.prompts, [key]: value },
    }));
  };

  const setBinding = (key: string, binding: PromptModelBinding | undefined) => {
    setDraft((prev) => {
      const next = { ...prev.promptModels };
      if (!binding) {
        delete next[key];
      } else {
        next[key] = binding;
      }
      return { ...prev, promptModels: next };
    });
  };

  const toggle = (key: string) => {
    setExpandedPrompts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <ToolbarButtonsSection
        draft={draft}
        setDraft={setDraft}
        helpers={helpers}
        globalAi={draft.ai}
      />
      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Agent
        </h3>
        <p className="text-xs text-fg-muted mb-3">
          Uses the default AI Config model unless you pick another endpoint and model. Keys stay on
          the AI Config tab.
        </p>
        {helpers && (
          <PromptModelBindingSelect
            heading="Model for Agent"
            bare
            binding={draft.agentModel}
            globalAi={draft.ai}
            modelsByBaseUrl={helpers.modelsByBaseUrl}
            onChange={(binding) =>
              setDraft((prev) => ({ ...prev, agentModel: binding }))
            }
            onFetch={helpers.fetchModelsForUrl}
            isFetching={
              draft.agentModel?.baseUrl
                ? helpers.isFetchingModelsForUrl(draft.agentModel.baseUrl)
                : false
            }
          />
        )}
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Primary Operations
        </h3>
        <p className="text-xs text-fg-muted mb-3">
          Optionally route each prompt to a different endpoint and model. Keys are configured on the
          AI Config tab.
        </p>
        {PRIMARY_PROMPTS.map((promptType) => (
          <PromptEditor
            key={promptType}
            promptType={promptType}
            value={draft.prompts[promptType]}
            binding={draft.promptModels[promptType]}
            expanded={!!expandedPrompts[promptType]}
            onToggle={() => toggle(promptType)}
            onChange={(v) => setPrompt(promptType, v)}
            onBindingChange={(b) => setBinding(promptType, b)}
            helpers={helpers}
            globalAi={draft.ai}
          />
        ))}
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Polish Operations (More Menu)
        </h3>
        {POLISH_PROMPTS.map((promptType) => (
          <PromptEditor
            key={promptType}
            promptType={promptType}
            value={draft.prompts[promptType]}
            binding={draft.promptModels[promptType]}
            expanded={!!expandedPrompts[promptType]}
            onToggle={() => toggle(promptType)}
            onChange={(v) => setPrompt(promptType, v)}
            onBindingChange={(b) => setBinding(promptType, b)}
            helpers={helpers}
            globalAi={draft.ai}
          />
        ))}
      </SettingsCard>
    </div>
  );
};

/**
 * @fileoverview Pure helpers for the customizable AI toolbar.
 * Single source of truth for builtin button metadata, prompt template
 * resolution (builtins + user-created `custom:<id>` ops), layout validation,
 * and auto-overflow math. No DOM or storage imports so every helper is
 * unit-testable.
 * @module @services/toolbarConfig
 */

import type {
  BuiltinOperation,
  CustomToolbarOp,
  PromptModelMap,
  PromptSettings,
  ToolbarConfig,
} from '../db/characterTypes';
import { DEFAULT_TOOLBAR_ORDER, normalizeToolbarConfig } from '../db/characterTypes';

/** Render metadata for one toolbar button. */
export interface ToolbarButtonDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  isCustom: boolean;
}

/** Builtin button chrome. Matches the historical toolbar styling. */
export const BUILTIN_TOOLBAR_BUTTONS: Record<BuiltinOperation, ToolbarButtonDef> = {
  expand: { id: 'expand', label: 'Enhance', icon: '✨', color: 'var(--ai-toolbar-accent-primary)', isCustom: false },
  rewrite: { id: 'rewrite', label: 'Rephrase', icon: '🔄', color: 'var(--ai-toolbar-accent-secondary)', isCustom: false },
  instruct: { id: 'instruct', label: 'Custom', icon: '💬', color: 'var(--ai-toolbar-accent-success)', isCustom: false },
  shorten: { id: 'shorten', label: 'Shorten', icon: '✂️', color: 'var(--ai-toolbar-accent-warning)', isCustom: false },
  lengthen: { id: 'lengthen', label: 'Lengthen', icon: '📄', color: 'var(--ai-toolbar-accent-info)', isCustom: false },
  vivid: { id: 'vivid', label: 'Vivid', icon: '🎨', color: 'var(--ai-toolbar-accent-pink)', isCustom: false },
  emotion: { id: 'emotion', label: 'Emotion', icon: '❤️', color: 'var(--ai-toolbar-accent-rose)', isCustom: false },
  grammar: { id: 'grammar', label: 'Fix', icon: '🪄', color: 'var(--ai-toolbar-accent-neutral)', isCustom: false },
};

/** Default chrome for user-created buttons. */
export const CUSTOM_BUTTON_COLOR = 'var(--ai-toolbar-accent-neutral)';

/** Icon choices offered when creating a custom button. */
export const TOOLBAR_ICON_PALETTE: string[] = [
  '✨', '🔄', '💬', '✂️', '📄', '🎨', '❤️', '🪄',
  '🔥', '🌙', '⚔️', '🛡️', '💀', '🌿', '⭐', '💡',
  '📝', '🎭', '🧪', '📌',
];

/** Whether an op id is one of the builtins. */
export function isBuiltinOperation(operation: string): operation is BuiltinOperation {
  return (DEFAULT_TOOLBAR_ORDER as string[]).includes(operation);
}

/**
 * Resolve the ordered button defs for a toolbar config. Unknown ids are
 * skipped (normalization should already have removed them).
 */
export function resolveToolbarButtons(config: ToolbarConfig | undefined): ToolbarButtonDef[] {
  const normalized = normalizeToolbarConfig(config);
  const customs = new Map(normalized.customOps.map((op) => [op.id, op]));
  const defs: ToolbarButtonDef[] = [];
  for (const id of normalized.order) {
    if (isBuiltinOperation(id)) {
      defs.push(BUILTIN_TOOLBAR_BUTTONS[id]);
      continue;
    }
    const custom = customs.get(id);
    if (custom) {
      defs.push({
        id: custom.id,
        label: custom.label,
        icon: custom.icon,
        color: CUSTOM_BUTTON_COLOR,
        isCustom: true,
      });
    }
  }
  return defs;
}

/** Label lookup for result chrome / payload preview. Falls back to the raw id. */
export function toolbarButtonLabel(operation: string, customOps: readonly CustomToolbarOp[] = []): string {
  if (isBuiltinOperation(operation)) return BUILTIN_TOOLBAR_BUTTONS[operation].label;
  return customOps.find((op) => op.id === operation)?.label ?? operation;
}

/**
 * Resolve the prompt template for any toolbar op. Builtins come from the
 * prompt settings map; customs carry their own template.
 */
export function resolvePromptTemplate(
  operation: string,
  prompts: PromptSettings,
  customOps: readonly CustomToolbarOp[] = [],
): string {
  if (isBuiltinOperation(operation)) return prompts[operation];
  const custom = customOps.find((op) => op.id === operation);
  if (!custom) throw new Error(`Unknown toolbar operation: ${operation}`);
  return custom.prompt;
}

/** Validate a custom op draft for the settings UI. Returns the first error. */
export function validateCustomOp(
  input: { label: string; prompt: string },
  takenLabels: readonly string[] = [],
): string | null {
  const label = input.label.trim();
  if (!label) return 'Button label is required';
  if (label.length > 40) return 'Button label must be 40 characters or less';
  const lowered = takenLabels.map((l) => l.trim().toLowerCase());
  if (lowered.includes(label.toLowerCase())) return `A button labeled "${label}" already exists`;
  if (!input.prompt.includes('${text}')) return 'Custom prompt must contain ${text}';
  return null;
}

/** Validate a whole toolbar config for save. Returns joined errors or null. */
export function validateToolbarConfig(config: ToolbarConfig): string | null {
  const normalized = normalizeToolbarConfig(config);
  const errors: string[] = [];
  const builtinLabels = new Set(
    Object.values(BUILTIN_TOOLBAR_BUTTONS).map((b) => b.label.toLowerCase()),
  );
  const seen = new Set<string>();
  for (const op of normalized.customOps) {
    const err = validateCustomOp(op, []);
    if (err) {
      errors.push(`${op.label || op.id}: ${err}`);
      continue;
    }
    const lowered = op.label.trim().toLowerCase();
    if (builtinLabels.has(lowered)) {
      errors.push(`"${op.label}" collides with a built-in button label`);
    } else if (seen.has(lowered)) {
      errors.push(`Duplicate button label "${op.label}"`);
    }
    seen.add(lowered);
  }
  return errors.length > 0 ? errors.join('\n') : null;
}

/** Move an op id within the order list. Index is clamped. */
export function moveToolbarOp(order: readonly string[], id: string, toIndex: number): string[] {
  const next = order.filter((entry) => entry !== id);
  if (!order.includes(id)) return [...order];
  const clamped = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clamped, 0, id);
  return next;
}

/** Drop model bindings for deleted custom ops; keep builtins and live customs. */
export function prunePromptModelsForToolbar(
  promptModels: PromptModelMap | null | undefined,
  config: ToolbarConfig,
): PromptModelMap {
  if (!promptModels || typeof promptModels !== 'object') return {};
  const normalized = normalizeToolbarConfig(config);
  const liveCustom = new Set(normalized.customOps.map((op) => op.id));
  const result: PromptModelMap = {};
  for (const [key, binding] of Object.entries(promptModels)) {
    if (isBuiltinOperation(key) || liveCustom.has(key)) {
      result[key] = binding;
    }
  }
  return result;
}

/** Stable id for a newly created custom button. */
export function createCustomOpId(): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `custom:${suffix}`;
}

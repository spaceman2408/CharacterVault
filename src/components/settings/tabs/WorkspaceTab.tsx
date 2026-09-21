/**
 * @fileoverview Character workspace preferences tab (default chat, agent edits, editor links, spellcheck).
 * @module components/settings/tabs/WorkspaceTab
 */

import React, { useEffect, useState } from 'react';
import { Bot, Braces, ExternalLink, Languages, MessageSquare, Quote, ShieldCheck } from 'lucide-react';
import type {
  DefaultChatPanel,
  MacroHighlightSettings,
  RoleplayHighlightSettings,
} from '../../../db/characterTypes';
import {
  DEFAULT_MACRO_HIGHLIGHT_SETTINGS,
  DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS,
} from '../../../db/characterTypes';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsToggle } from '../components/SettingsToggle';
import type { SettingsTabProps } from '../types';

const CHAT_PANEL_OPTIONS: Array<{
  id: DefaultChatPanel;
  label: string;
  hint: string;
  Icon: typeof MessageSquare;
}> = [
  { id: 'orion', label: 'Orion', hint: 'Chat that does not write the card', Icon: MessageSquare },
  { id: 'agent', label: 'Agent', hint: 'Chat that writes the open card or book', Icon: Bot },
];

type RoleplayColorKey = 'dialogue' | 'narration' | 'action';

type MacroColorKey = 'macroChar' | 'macroUser';

type EditorColorKey = RoleplayColorKey | MacroColorKey;

const ROLEPLAY_COLOR_FIELDS: Array<{ key: RoleplayColorKey; label: string; hint: string }> = [
  { key: 'dialogue', label: 'Quoted dialogue', hint: '"spoken words"' },
  { key: 'narration', label: 'Narration', hint: 'plain prose (blank = editor text)' },
  { key: 'action', label: 'Asterisked actions', hint: '*emotes*' },
];

const MACRO_COLOR_FIELDS: Array<{
  key: MacroColorKey;
  setting: keyof MacroHighlightSettings;
  label: string;
  hint: string;
}> = [
  { key: 'macroChar', setting: 'char', label: '{{char}}', hint: 'character name placeholder' },
  { key: 'macroUser', setting: 'user', label: '{{user}}', hint: 'player name placeholder' },
];

function roleplayFallback(key: RoleplayColorKey): string {
  return DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS[key];
}

function cssValueToHex(value: string): string | null {
  if (isHexColor(value)) return value.toLowerCase();
  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/.exec(value);
  if (!match) return null;
  const channel = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${channel(Number(match[1]))}${channel(Number(match[2]))}${channel(Number(match[3]))}`;
}

/** Display color for the narration picker when it follows the editor text. */
function editorTextHex(): string {
  if (typeof document === 'undefined') return '#6b7280';
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--editor-text').trim();
  return cssValueToHex(raw) ?? '#6b7280';
}

/** Display color for a picker whose setting is blank (follow the theme). */
function themeVarHex(name: '--macro-char' | '--macro-user'): string {
  if (typeof document === 'undefined') return '#6b7280';
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return cssValueToHex(raw) ?? '#6b7280';
}

/** Picker display value for a blank setting. */
function blankDisplayHex(colorKey: EditorColorKey): string {
  switch (colorKey) {
    case 'narration':
      return editorTextHex();
    case 'macroChar':
      return themeVarHex('--macro-char');
    case 'macroUser':
      return themeVarHex('--macro-user');
    default:
      return roleplayFallback(colorKey);
  }
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

const EditorColorRow: React.FC<{
  colorKey: EditorColorKey;
  label: string;
  hint: string;
  value: string;
  disabled: boolean;
  /** When true, clearing the field restores the theme default. */
  allowBlank: boolean;
  onChange: (hex: string) => void;
}> = ({ colorKey, label, hint, value, disabled, allowBlank, onChange }) => {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const pickerValue = isHexColor(value) ? value : blankDisplayHex(colorKey);

  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={`${label} color picker`}
        value={pickerValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-border-strong bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-fg-subtle">{hint}</p>
      </div>
      <input
        type="text"
        aria-label={`${label} hex color`}
        value={text}
        disabled={disabled}
        spellCheck={false}
        maxLength={7}
        placeholder={allowBlank ? 'auto' : undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value === '' && allowBlank) onChange('');
          else if (isHexColor(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        onBlur={() => setText(value)}
        className="w-20 shrink-0 rounded-lg border border-border-strong bg-surface px-2 py-1.5 font-mono text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
      />
    </div>
  );
};

export const WorkspaceTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  const roleplay: RoleplayHighlightSettings =
    draft.roleplayHighlight ?? { ...DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS };

  const setRoleplay = (updates: Partial<RoleplayHighlightSettings>) =>
    setDraft((prev) => ({
      ...prev,
      roleplayHighlight: {
        ...(prev.roleplayHighlight ?? DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS),
        ...updates,
      },
    }));

  const macro: MacroHighlightSettings =
    draft.macroHighlight ?? { ...DEFAULT_MACRO_HIGHLIGHT_SETTINGS };

  const setMacro = (updates: Partial<MacroHighlightSettings>) =>
    setDraft((prev) => ({
      ...prev,
      macroHighlight: {
        ...(prev.macroHighlight ?? DEFAULT_MACRO_HIGHLIGHT_SETTINGS),
        ...updates,
      },
    }));

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Chat panel
        </h3>
        <p className="text-sm font-medium text-fg mb-1">Default chat</p>
        <p className="text-xs text-fg-muted mb-3 leading-relaxed">
          Ask AI opens on this chat when you open a character or lorebook. You can still switch in
          the header.
        </p>
        <div
          role="radiogroup"
          aria-label="Default chat panel"
          className="grid grid-cols-2 gap-2"
        >
          {CHAT_PANEL_OPTIONS.map(({ id, label, hint, Icon }) => {
            const selected = draft.defaultChatPanel === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDraft((prev) => ({ ...prev, defaultChatPanel: id }))}
                className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-border bg-surface text-fg-muted hover:bg-hover/60 hover:text-fg'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </span>
                <span className={`text-[11px] leading-snug ${selected ? 'text-accent/80' : 'text-fg-subtle'}`}>
                  {hint}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Agent edits
        </h3>
        <SettingsToggle
          stacked
          checked={draft.requireAgentReview}
          onChange={(checked) =>
            setDraft((prev) => ({ ...prev, requireAgentReview: checked }))
          }
          label="Review agent edits before applying"
          description={
            <>
              When enabled, the Agent stages its card and lorebook edits instead of writing
              them directly. You can review each change, edit the proposed text, and approve
              or deny changes before anything is applied. Snapshots are still taken when you
              apply.
            </>
          }
        />
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Editor links
        </h3>
        <SettingsToggle
          stacked
          checked={draft.markdownImageOpenLinks}
          onChange={(checked) =>
            setDraft((prev) => ({ ...prev, markdownImageOpenLinks: checked }))
          }
          label="Open Markdown image links on click"
          description={
            <>
              When enabled, clicking image syntax like{' '}
              <code className="text-xs">![](https://…)</code> opens the URL after a safety warning.
              Highlighting stays on either way. Drag to select text without opening.
            </>
          }
        />
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Quote className="w-4 h-4" />
          Roleplay colors
        </h3>
        <div className="space-y-4">
          <SettingsToggle
            stacked
            checked={roleplay.enabled}
            onChange={(checked) => setRoleplay({ enabled: checked })}
            label="Color dialogue, narration, and actions"
            description={
              <>
                Applies to every prose editor. Text in <code className="text-xs">&quot;quotes&quot;</code>{' '}
                uses the dialogue color, <code className="text-xs">*asterisks*</code> use the
                action color, and everything else uses the narration color.{' '}
                <code className="text-xs">{'{{char}}'}</code> and{' '}
                <code className="text-xs">{'{{user}}'}</code> keep their own macro colors.
              </>
            }
          />

          <div className="space-y-3">
            {ROLEPLAY_COLOR_FIELDS.map(({ key, label, hint }) => (
              <EditorColorRow
                key={key}
                colorKey={key}
                label={label}
                hint={hint}
                value={roleplay[key]}
                disabled={!roleplay.enabled}
                allowBlank={key === 'narration'}
                onChange={(hex) => setRoleplay({ [key]: hex })}
              />
            ))}
          </div>

          <div
            aria-label="Roleplay color preview"
            className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm leading-relaxed"
          >
            <span style={{ color: roleplay.action }}>*He steps closer, rain dripping from his coat.* </span>
            <span style={{ color: roleplay.dialogue }}>&quot;Stay with me.&quot; </span>
            <span style={{ color: roleplay.narration || undefined }}>The storm keeps falling outside.</span>
          </div>

          <button
            type="button"
            disabled={!roleplay.enabled}
            onClick={() => setRoleplay({ ...DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS, enabled: true })}
            className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
          >
            Reset to default colors
          </button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Braces className="w-4 h-4" />
          Name macro colors
        </h3>
        <div className="space-y-4">
          <p className="text-xs text-fg-muted leading-relaxed">
            <code className="text-xs">{'{{char}}'}</code> and{' '}
            <code className="text-xs">{'{{user}}'}</code> follow the theme by default. Pick a
            color to override one; clear the field to go back to automatic.
          </p>

          <div className="space-y-3">
            {MACRO_COLOR_FIELDS.map(({ key, setting, label, hint }) => (
              <EditorColorRow
                key={key}
                colorKey={key}
                label={label}
                hint={hint}
                value={macro[setting]}
                disabled={false}
                allowBlank
                onChange={(hex) => setMacro({ [setting]: hex })}
              />
            ))}
          </div>

          <div
            aria-label="Name macro color preview"
            className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm leading-relaxed"
          >
            <span style={{ color: macro.char || themeVarHex('--macro-char') }}>{'{{char}}'}</span>
            {' greets '}
            <span style={{ color: macro.user || themeVarHex('--macro-user') }}>{'{{user}}'}</span>
            {' with a smile.'}
          </div>

          <button
            type="button"
            onClick={() => setMacro({ ...DEFAULT_MACRO_HIGHLIGHT_SETTINGS })}
            className="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
          >
            Reset to automatic colors
          </button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Languages className="w-4 h-4" />
          Spellcheck
        </h3>
        <div className="space-y-4">
          <SettingsToggle
            stacked
            checked={draft.spellcheckEnabled}
            onChange={(checked) =>
              setDraft((prev) => ({ ...prev, spellcheckEnabled: checked }))
            }
            label="Enable in-editor spellcheck"
            description={
              <>
                Underlines misspellings and offers quick-fix suggestions when hovering over a
                flagged word. The dictionary is fetched on first use and cached locally for offline
                access.
              </>
            }
          />

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-fg-muted mb-2">
              <span className="p-1.5 rounded-md bg-muted text-fg-muted">
                <Languages className="w-4 h-4" />
              </span>
              Language
            </label>
            <select
              value={draft.spellcheckLanguage}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, spellcheckLanguage: e.target.value }))
              }
              className="w-full px-3 py-2.5 border border-border-strong rounded-lg bg-surface text-fg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all duration-200"
            >
              <option value="en">English (en-US)</option>
            </select>
            <p className="mt-2 text-xs text-fg-muted">
              Additional language packs will appear here as they&apos;re bundled.
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

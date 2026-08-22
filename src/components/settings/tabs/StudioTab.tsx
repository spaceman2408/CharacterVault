/**
 * @fileoverview Studio preferences tab (vortex, default chat, editor links, spellcheck).
 * @module components/settings/tabs/StudioTab
 */

import React from 'react';
import { Bot, ExternalLink, Languages, MessageSquare, Wand2 } from 'lucide-react';
import type { DefaultChatPanel } from '../../../db/characterTypes';
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

export const StudioTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Wand2 className="w-4 h-4" />
          AI Creation Studio
        </h3>
        <SettingsToggle
          stacked
          checked={draft.showLuckyVortex}
          onChange={(checked) => setDraft((prev) => ({ ...prev, showLuckyVortex: checked }))}
          label={'Show "I\'m Feeling Lucky" vortex animation'}
          description={
            <>
              When enabled, pressing the &quot;I&apos;m Feeling Lucky&quot; button plays a swirling
              tag vortex animation before generating. When disabled, random tags are chosen
              instantly without any visual effect.
            </>
          }
        />
      </SettingsCard>

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

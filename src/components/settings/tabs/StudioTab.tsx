/**
 * @fileoverview Studio preferences tab (vortex animation + spellcheck).
 * @module components/settings/tabs/StudioTab
 */

import React from 'react';
import { Languages, Wand2 } from 'lucide-react';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsToggle } from '../components/SettingsToggle';
import type { SettingsTabProps } from '../types';

export const StudioTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider mb-4 flex items-center gap-2">
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
        <h3 className="text-xs font-bold text-vault-500 uppercase tracking-wider mb-4 flex items-center gap-2">
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
            <label className="flex items-center gap-2 text-sm font-medium text-vault-700 dark:text-vault-300 mb-2">
              <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
                <Languages className="w-4 h-4" />
              </span>
              Language
            </label>
            <select
              value={draft.spellcheckLanguage}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, spellcheckLanguage: e.target.value }))
              }
              className="w-full px-3 py-2.5 border border-vault-300 dark:border-vault-600 rounded-lg bg-white dark:bg-vault-800 text-vault-900 dark:text-vault-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-vault-500/50 transition-all duration-200"
            >
              <option value="en">English (en-US)</option>
            </select>
            <p className="mt-2 text-xs text-vault-500">
              Additional language packs will appear here as they&apos;re bundled.
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

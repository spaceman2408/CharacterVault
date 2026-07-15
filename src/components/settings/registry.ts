/**
 * @fileoverview Settings tab registry — add new tabs here.
 * @module components/settings/registry
 */

import { Brain, LayoutGrid, MessageSquare, Palette, Sliders } from 'lucide-react';
import { AIConfigTab } from './tabs/AIConfigTab';
import { PromptsTab } from './tabs/PromptsTab';
import { SamplerTab } from './tabs/SamplerTab';
import { SectionsTab } from './tabs/SectionsTab';
import { StudioTab } from './tabs/StudioTab';
import type { SettingsTabModule } from './types';

/**
 * Ordered list of settings tabs.
 * To add a new tab: create `tabs/FooTab.tsx`, then append an entry here.
 */
export const SETTINGS_TABS: SettingsTabModule[] = [
  { id: 'ai', label: 'AI Config', icon: Brain, Component: AIConfigTab },
  { id: 'sampler', label: 'Sampler', icon: Sliders, Component: SamplerTab },
  { id: 'prompts', label: 'Prompts', icon: MessageSquare, Component: PromptsTab },
  { id: 'studio', label: 'Studio', icon: Palette, Component: StudioTab },
  { id: 'sections', label: 'Sections', icon: LayoutGrid, Component: SectionsTab },
];

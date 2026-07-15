# Settings — add / change

## Layout

| Path | Role |
|------|------|
| `registry.ts` | Tab list. New tab = file + one entry here. |
| `types.ts` | `SettingsDraft`, tab contract, helpers. |
| `hooks/useSettingsDraft.ts` | Load, validate, save. All persist goes through here. |
| `hooks/useModelCatalog.ts` | Model fetch/cache (AI tab only). |
| `hooks/useNanoGPTSignIn.ts` | NanoGPT OAuth (AI tab only). |
| `tabs/*.tsx` | One file per tab. UI only. |
| `components/*` | Shared controls (`SettingsToggle`, `SliderControl`, `SettingsCard`, …). |
| `config/aiBaseUrlPresets.ts` | Base URL presets + URL helpers. |
| `CharacterSettingsPanel.tsx` | Shell only. Do not dump tab UI here. |

Persistence: `services/CharacterSettingsService.ts` + types/defaults in `db/characterTypes.ts`.

Consumers (unchanged API): `CharacterWorkspace`, `AICreationStudio` — `isOpen`, `onClose`, optional `reloadSettings`.

## New field on existing tab

1. Type + default in `db/characterTypes.ts` if new data.
2. Service get/save if needed (`CharacterSettingsService`).
3. Add to `SettingsDraft` + load + save in `useSettingsDraft.ts`.
4. Control in the tab under `tabs/`.
5. If character workspace needs the value live: wire `CharacterEditorContext.reloadSettings` (and consumers).

## New tab

1. Same as field steps 1–3 for its data.
2. Create `tabs/FooTab.tsx` — `SettingsTabProps` (`draft`, `setDraft`, optional `helpers`).
3. Register in `SETTINGS_TABS` (`registry.ts`).
4. Prefer shared `components/*` over one-off markup.

## Rules

- Draft state only until Save. Do not write IndexedDB from tabs.
- AI-only side effects (models, OAuth, clear) live in helpers / AI hooks — not in other tabs.
- Defaults: `DEFAULT_SETTINGS` / `DEFAULT_*` in `characterTypes` — no duplicate hardcodes.
- No schema form engine. Complex UI stays custom tab components.
- Public export: `index.ts` → `CharacterSettingsPanel`.

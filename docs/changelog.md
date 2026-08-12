# Changelog

## 1.3.0 (unreleased)

Standalone lorebook vault, richer World Info editing, and recursion map. Full notes: [v1.3.0 release notes](/releases/v1.3.0).

### Highlights

- Home vault **Lorebooks** tab: CRUD, import/export, duplicate, open full workspace
- Shared lorebook editor for character-embedded and vault books (common ST fields + CodeMirror/AI content)
- One-way **attach** to characters (vault-local); optional **copy into embedded** for card export
- **Recursion map** rebuilt as a fullscreen web view (node graph, pan/zoom, hover spotlight) with staged bulk flag edits and per-entry flag toggles in the inspector
- Lorebook snapshots (open / auto / manual / rollback)
- Field help tips from SillyTavern World Info docs

Details: [Lorebook Vault](/features/lorebook-vault) · [Lorebook Editor](/features/lorebook-editor) · [Recursion map](/features/lorebook-editor#recursion-map) · [Map guide](/features/recursion-map-guide)

---

## 1.2.1 (2026-08-07)

Editor polish: Markdown image links, name macro colors, and smarter spellcheck. Full notes: [v1.2.1 release notes](/releases/v1.2.1).

### Highlights

- Markdown `![](url)` image syntax is highlighted; optional click-to-open with a leave-app warning
- Toggle under **Settings → Studio → Editor links** (highlight stays on either way)
- `{{char}}` / `{{user}}` name macros get distinct syntax colors
- Spellcheck skips Markdown image constructs and accepts hyphenated compounds when segments are valid

Details: [Editor → Markdown image links](/features/editor#markdown-image-links) · [Spellcheck](/features/editor#spellcheck)

---

## 1.2.0 (2026-08-03)

Custom context, lorebook context controls, and modern sampler defaults. Full notes: [v1.2.0 release notes](/releases/v1.2.0).

### Highlights

- Per-character **Custom context** in the AI Context panel (paste/edit, enable toggle, remove)
- Included in **Orion** and the **AI toolbar** (and lorebook key generation) when enabled
- Vault-local only — not on the card, not in PNG/JSON export or snapshots; copied on duplicate
- Lorebook **Enable All / Disable All** for context moved out of book settings into the entry list toolbar
- New-install defaults: streaming + reasoning on, neutral samplers, 8K context
- Quick presets Creative / Balanced / Factual updated (min-p first, top-k off); presets keep your context length
- Vault cards without art show a single **No image** label

Details: [AI Context → Custom Context](/features/ai-context#custom-context) · [Sampler Settings](/configuration/sampler-settings)

---

## 1.1.0 (2026-07-21)

Orion chat improvements and small polish. Full notes: [v1.1.0 release notes](/releases/v1.1.0).

### Highlights

- Smoother Orion streaming; stop mid-reply keeps partial answers
- Resizable desktop Orion panel; scroll that follows the stream until you scroll up
- Delete a message and trim the rest of the thread
- Snapshot history easier on phones; theme-aware tags and Feeling Lucky vortex
- Privacy notice linked from the app and docs

---

## 1.0.0 (2026-07-17)

First stable release. Full notes: [v1.0.0 release notes](/releases/v1.0.0).

### Highlights in this release

- Full UI refresh (vault, editor, settings, studio) and VS Code Dark+ style dark theme
- AI Context and Orion panels streamlined; context is user-pinned (not auto-bound to the open tab)
- Editor AI ghost preview, payload preview, and per-tool model routing
- NanoGPT sign-in, account overview, expanded reasoning effort, context up to 1M
- Vault backup, bulk import, sort/search, card token estimates
- Mobile full-screen greetings/lorebook and sheet-style model pickers
- Spellcheck, section layout customization, AI Creation Studio, snapshots

### Current Release Notes (detail)

- **Per-prompt model routing** — Settings → Prompts can map each toolbar operation to a specific base URL + model (any configured preset). Unmapped ops use global AI Config. Lorebook AI key generation follows the Custom/instruct mapping. Orion and AI Creation Studio remain on the global model. Clear AI Settings keeps prompt text and mappings.
- **Mobile model/provider sheets** — AI Config and Prompts model pickers use portaled bottom sheets (searchable, Escape-safe, touch-friendly) instead of clipped dropdowns.
- **AI toolbar ghost preview** — Enhance / Rephrase / Custom / polish ops preview in the editor as inline ghost text at the selection instead of a large top result panel. Thinking stays collapsible and collapsed by default; Accept / Reject and stats stay in a compact strip. While a suggestion is open the editor is read-only for typing, IndexedDB saves are held until Accept/Reject/cancel, Accept shows a success toast (green highlight flash removed), and leading/trailing newlines are matched to the original selection to avoid blank-line glitches.
- **NanoGPT Account card** — Balance (USD/Nano), subscription status, and quota bars when available; session cache + rate-limited refresh; skeleton layout avoids settings jump while loading.
- **Reasoning effort** — Expanded levels (`minimal` … `max` / `xhigh`); docs guide under Configuration; request repair remaps unsupported effort values and strips rejected non-standard sampler params with per-model session cache.
- **Context length up to 1M** — Sampler settings include 256K / 512K / 1M presets and a **Custom…** range (4,096–1,000,000 tokens). Values are clamped on save.
- **Large AI context packing** — Lorebook and alternate greetings are sent as separate chunks and fill the available window instead of being dropped when the whole block is too large. Token estimates and request trimming are stricter so big prompts are less likely to exceed the provider limit.
- **Vault backup** — Library **Backup** downloads a ZIP of all characters (PNG with image, JSON without).
- **Bulk import** — Multi-file import and drag-and-drop of PNG/JSON onto the library.
- **Library sort & search** — Sort by name or recent; search matches name and tags.
- **Card token estimates** — Active / total token estimates on each vault card (hover for exact counts).
- **Quick library export** — Export a single card as PNG or JSON from card actions without opening the editor.
- **API key field** — More stable field naming so browser password managers are less likely to hijack the AI key input.
- **In-editor spellcheck** — A Hunspell-backed spellchecker (English dictionary) runs inside the shared editor. Misspelled words are underlined with a wavy-red decoration; hover one to see a quick-fix tooltip with suggestions plus **Ignore word** and **Add to dictionary**. Code fences, `{{macro}}` placeholders, numbers, and ALL-CAPS acronyms are skipped automatically. Creator Notes (HTML) and Extensions (JSON) are language-aware: HTML tag structure and JSON property keys are skipped so technical content doesn't pollute the underline. Your ignored words and personal dictionary persist across all cards. Toggle the feature in **Settings → Studio → Spellcheck**. The dictionary is cached in IndexedDB after first load, so it works offline.
- **NanoGPT PKCE sign-in** — Sign in to NanoGPT directly from Settings → AI Config with a new **Sign in with NanoGPT** button. The OAuth flow uses PKCE (no client secret, no password leaves NanoGPT), and your available models are automatically fetched and loaded into the model picker as soon as sign-in completes. Popup blockers must be allowed. Works on Chrome for Android; other mobile browsers may not relay the auth code back — paste an API key manually if sign-in doesn't complete on your phone.
- Added a **Sections** tab in Settings — hide, reorder, and reset your section tabs to match your workflow.
- Improved the AI Settings tabs so they are easier to read and no longer overlap.
- Reduced unwanted browser password prompts when entering AI settings.
- Improved the character history view for screen readers.
- Added simple editing for character names and creator names.
- Added a cleaner tag editor where you can add, paste, and remove tags quickly.
- Improved tag choices in AI Creation Studio so related tags work together more reliably.

### Latest Commits (Newest to Oldest)

- `6b077a7` - feat(settings): Prompts tab per-operation model routing UI
- `f8574b2` - feat(settings): mobile-friendly model and provider picker sheets
- `fae7f3e` - feat(ai): apply prompt model map to toolbar and lorebook requests
- `0268062` - feat(settings): persist and load per-prompt model routing map
- `f2e405d` - feat(ai): add per-prompt model binding types and config resolver
- `81ebf71` - Merge branch 'feat/ai-request-param-repair'
- `62c142a` - feat(ai): remaps rejected request params and expands reasoning effort
- `7aedd8d` - docs: document AI toolbar ghost preview in editor, FAQ, and release notes
- `ef2709c` - feat(editor): in-editor AI ghost preview for toolbar edits
- `cd8b170` - feat(settings): show NanoGPT balance and subscription usage at a glance
- `c0f175c` - refactor(settings): persist NanoGPT account cache across unmount
- `879cf12` - fix(settings): use current subscription-only flag when fetching models
- `58bd001` - feat(editor): improve AI accept feedback, shortcuts, and selection lock
- `944142b` - fix(editor): abort in-flight AI on unmount and ignore stale results
- `65a9c8d` - feat(ai): raise context to 1M and fix large-lorebook budgeting
- `663a513` - feat(vault): backup, bulk import, sort/search, and token estimates
- `969dfbf` - update ignore
- `995c932` - refactor(settings): use useId for AI API key field name
- `3238cf4` - refactor(settings): split panel into modular tabs and registry
- `00c188d` - feat(auth): auto-fetch models after NanoGPT OAuth sign-in
- `f019115` - style(ui): update NanoGPT sign-in success toast message
- `55c0ec7` - feat(auth): add NanoGPT OAuth sign-in flow
- `974ff11` - refactor(ai): enhance copy button timeout handling and variable scoping
- `461ace4` - feat(mobile): enable copy button visibility on mobile devices
- `43bb8ce` - feat(ui): add stats tooltip and mobile copy button visibility
- `4379702` - feat(ai): implement response performance metrics
- `2789636` - feat(character): adjust sampler parameter ranges
- `8952b08` - perf(character): optimize model caching and provider selection
- `456ded4` - feat(eslint): add 'docs' to global ignores in ESLint configuration
- `a33ff1d` - feat(character): add caching for AI models in settings panel
- `52de543` - feat(character): implement imported character flag for conditional snapshot creation
- `cce7d44` - feat(ui): add create new button and improve create form layout for mobile
- `281be66` - fix(editor): integrate toolbar search with CodeMirror panel lifecycle to stop selection scroll oscillation
- `324ce81` - feat(editor): enhance search navigation with auto-scroll and panel positioning
- `9a014e0` - fix(ai): resolve context at call time to prevent stale system prompt
- `1992244` - feat(editor): add custom tab handling and indentation settings in useAIEditor
- `9722bba` - feat(editor): add lorebook import and export functionality
- `640e573` - refactor(lorebook): filter out empty character books during export
- `9d0d662` - refactor(history): prevent content flash during modal entrance with delayed visibility
- `d4f9696` - feat(components): enhance input handling and loading animations
- `9fc0bd7` - refactor(db): implement content-addressed storage for character images
- `aa4cc58` - feat(ai): enable multi-line input in AI chat and toolbar panels
- `24a629d` - refactor(lorebook): swap name and comment fields in entry editor to match SillyTavern convention
- `f4618c6` - refactor(lorebook): extract case_sensitive extension handling to variable
- `7851a6f` - fix(lorebook): Lorebook Export/Import Compatibility Fix

# What's New

Quick overview of recent updates to CharacterVault.

---

## July 2026

### Larger Context Windows & Smarter AI Budgeting

AI work with big cards is much more reliable. You can raise the context window far past the old 128K cap, and large lorebooks actually make it into the request.

- **Up to 1M context** — **Settings → Sampler → Context Length** includes 256K, 512K, and 1M presets, plus **Custom…** for any value from 4K to 1M
- **Lorebook & greetings fill the window** — Selected lorebook entries (and long greeting lists) are packed in piece by piece so you get as much context as the budget allows, instead of almost none
- **Safer requests** — CharacterVault is more careful about staying under your Context Length and Max Tokens, which cuts down on “prompt too long” errors from providers

[Sampler settings →](/configuration/sampler-settings)  
[AI Context panel →](/features/ai-context)

---

### Vault Library Upgrades

The home library is built for bigger collections.

- **Backup** — Download a ZIP of every character (PNG when there is an image, JSON otherwise)
- **Bulk import** — Import many cards at once, including **drag and drop** onto the library
- **Sort** — Switch between **Name** and **Recent** (preference is remembered)
- **Search** — Find cards by **name or tags**
- **Token estimates** — Each card shows **active / total** estimates; hover for exact counts
- **Quick export** — PNG or JSON from the card actions without opening the editor

[Vault organization →](/features/vault-organization)  
[Import & export →](/features/import-export)

---

### Smaller Improvements

- **API key field** — Less likely to trigger browser password-manager prompts when pasting a key in AI settings

---

## June 2026

### In-Editor Spellcheck

A Hunspell-backed spellchecker — the same engine LibreOffice uses — now runs inside the character editor. Misspelled words get a wavy-red underline; hover one to see quick-fix suggestions, **Ignore word**, or **Add to dictionary**.

- **Affix-aware** — `running`, `ran`, and `runs` all pass without you whitelisting anything
- **Smart ignores** — Code fences, `{{macro}}` placeholders, numbers, URLs/emails, and ALL-CAPS acronyms are skipped automatically
- **Personal dictionary & per-user ignore list** — Add good-but-uncommon words (character names, neologisms) once and they stick across all your cards
- **Toggle in Settings** — Disable in **Settings → Studio → Spellcheck** if you don't want it
- **Offline-friendly** — The English dictionary is fetched once on first use and cached locally so it works without a connection

::: tip Performance
Spellchecking is debounced and viewport-scoped, so even large lorebooks stay responsive.
:::

[Learn more →](/features/editor#spellcheck)

---

### NanoGPT Sign-In (PKCE) with Auto Model Fetch

You can now sign in to NanoGPT directly from **Settings → AI Config** — no need to copy an API key from your dashboard. The flow uses OAuth with PKCE (Proof Key for Code Exchange), so your password never leaves NanoGPT's site and no client secret is stored in CharacterVault.

- **One-click sign-in** — A new **Sign in with NanoGPT** button appears next to the API Key field when the Nano-GPT preset is selected.
- **Auto-fetch models** — On successful sign-in, your available models are fetched automatically and the model dropdown is populated for you.
- **Per-URL caching** — The auto-fetch uses the same per-base-URL cache as manual fetches, so reopening the settings panel loads instantly.

::: tip Browser popups must be allowed
The flow opens a new window/tab to NanoGPT. Allow popups for this site if your browser blocks them.
:::

::: warning Mobile
Works on Chrome for Android. Other mobile browsers may not relay the auth code back to the app — if sign-in doesn't complete, paste an API key manually.
:::

[Learn more →](/configuration/ai-setup#sign-in-with-nanogpt-pkce)

---

### Customizable Section Tabs

The character editor has 18 section tabs by default — more than most people need. A new **Sections** tab in Settings lets you hide the tabs you don't use, reorder the rest however you like, and reset to the default order at any time.

- **Show or hide** — Toggle any section tab on or off with the eye icon
- **Reorder** — Move tabs up and down with arrow buttons
- **Reset to Defaults** — Restore the original layout in one click
- **Mobile-friendly** — Arrow buttons work great on touchscreens; the mobile dropdown respects your custom order and visibility

[Learn more →](/configuration/section-layout)

---

## May 2026

### AI Creation Studio

The new **AI Creation Studio** lets you generate complete character cards from scratch using AI. Describe your concept or select from curated tags, and the AI creates a name, description, first message, and example dialogue in one flow.

**Features:**
- **Write Mode** — Free-form concept descriptions
- **Tags Mode** — Visual tag selection across 6 categories (Identity, Personality, Role, Genre, Tone, Appearance)
- **Feeling Lucky** — Random tag generation with visual vortex animation
- **Live Preview** — Edit generated fields in real-time
- **Field Regeneration** — Retry or regenerate individual fields

[Learn more →](/features/ai-creation-studio)

---

### Model Caching in Settings

The **Character Settings** panel now caches available AI models and providers, so the model list loads instantly on repeat visits. No more waiting for your model provider to respond every time you switch back.

[Configure your AI provider →](/configuration/ai-setup)

---

### Response Performance Stats

AI responses now show performance metrics when complete — look for **TTFT** (time to first token) and **T/S** (tokens per second) in the result header. Available in both the **AI Assistant** chat and the **AI Toolbar** result panel.

[AI Assistant →](/features/ai-assistant)  
[Text Editor →](/features/editor)

---

### Mobile Copy Buttons

The copy button on chat messages now appears on mobile devices, so you can quickly grab AI-generated text from your phone or tablet.

---

### Adjusted Sampler Ranges

The character sampler parameter sliders (temperature, top-p, etc.) now have a wider and more sensible range, giving you finer control over your generations.

[Sampler Settings →](/configuration/sampler-settings)

---

## April 2026

### Lorebook Import & Export

You can now import and export lorebooks independently from the **Lorebook Editor**.

- **Export** — Save your character's lorebook as a JSON file for sharing or backup
- **Import** — Bring in lorebook data from JSON files exported by SillyTavern and other tools

[Learn more →](/features/lorebook-editor#import--export)

---

### Multi-line Input in AI Panels

The AI chat input and toolbar custom instructions now support multi-line text. Press **Shift+Enter** to insert line breaks when writing longer prompts or detailed instructions.

- **AI Assistant chat** — Multi-line input for complex queries to Orion
- **AI Toolbar** — Multi-line custom instructions for text operations

[AI Assistant →](/features/ai-assistant)  
[Text Editor →](/features/editor)

---

### Smaller Improvements

- **Lorebook editor** — Empty character books are filtered out during export
- **History modal** — Prevented content flash during modal entrance
- **Character images** — Implemented content-addressed storage for deduplication
- **Lorebook UI** — Swapped name and comment fields to match SillyTavern convention

---

## See Also

- [Full Changelog](/changelog)
- [Getting Started](/getting-started/installation)

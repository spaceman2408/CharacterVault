# What's New

Quick overview of recent updates to CharacterVault.

---

## August 2026

### 1.4.1

Agent chat polish, a rewritten tutorial, and a way to try upcoming builds.

- Composer stays usable during an Agent run; **Agent writing** is in the workspace header
- Assistant text streams after thinking; retry clears error bubbles on the message
- If a model rejects native `tools`, that model stays on XML for the rest of the session
- First-run walkthrough matches the current product (replay from the vault **?**)
- On production, a dismissible header strip links to [staging.charactervault.app](https://staging.charactervault.app)

[Release 1.4.1 →](/releases/v1.4.1) · [AI Agent →](/features/ai-agent)

### Agent (1.4.0)

A second chat next to Orion that **fills and revises** the open character or standalone lorebook.

- Toggle **Agent** in the Ask AI header (character workspace or lorebook vault), or set **Settings → Studio → Chat panel** to open there
- Optional [custom context](/features/ai-context#custom-context) as source notes; it reads fields and entries with tools
- Snippet edits match existing text; tool calls show as short color-coded lines
- Writes once when the run finishes (snapshot first). **Stop**, then empty **Send**, retries
- Own model on **Settings → Prompts → Agent** (Default follows AI Config)
- Greeting 1 is the first alternate, same as the editor
- History stays lighter (metadata index, opened-card snapshot last); long chats keep the last 100 messages
- **NanoGPT cache routing** — **Cache-capable provider routing** toggle (Settings → AI Config → NanoGPT Options) sends `caching: true` to route to a cache-capable provider for lower cost and latency (sticky by default; fails if none serves the model)

[Release 1.4.0 →](/releases/v1.4.0) · [AI Agent →](/features/ai-agent) · [AI Setup → NanoGPT Options](/configuration/ai-setup#nanogpt-options) · [Snapshots](/features/snapshots-history)

### Provider usage cards (1.3.1)

- **Synthetic** — new preset. Model list prefers `syn:` aliases; **Synthetic Usage** shows five-hour request and weekly credit quotas
- **OpenRouter** — dedicated adapter plus **OpenRouter Usage**: this key’s spend (today / week / month / all time), optional spending cap, and free-tier `:free` rate limits
- **API key field** — masked text, not a password input, so browsers are less likely to offer to save Settings as a login

[Release 1.3.1 →](/releases/v1.3.1) · [AI Setup](/configuration/ai-setup) · [Synthetic Usage](/configuration/ai-setup#synthetic-usage) · [OpenRouter Usage](/configuration/ai-setup#openrouter-usage)

### Lorebook Vault & recursion map (1.3.0)

- **Lorebook library** on the home vault: create, search, import, export, duplicate, delete standalone World Info books
- **Full book workspace** with shared lorebook editor, Orion chat, and snapshot history
- **Link** library books to characters: **Open in vault** updates the library book from the character; edits in the Lorebooks workspace update every linked character. Export still uses the lorebook on the card.
- **ST field coverage** for common world-info options (selective logic, recursion flags, depth/role, probability, book scan depth / token budget)
- **Content-first editor**: keys, Enabled / Constant, and the content editor stay on screen. **Options** and **Attach** are header buttons that open over the editor (not stacked above it). Works on phones: list and entry swap, **Attach** stays reachable from the list
- **Recursion map** rebuilt: fullscreen **web view** of every unlock path in the book, with pan/zoom, hover spotlight, a list fallback for big books, per-entry flag toggles, and staged bulk edits you review before applying
- Field **?** help aligned with SillyTavern World Info docs

[Release 1.3.0 →](/releases/v1.3.0) · [Lorebook Vault](/features/lorebook-vault) · [Lorebook Editor](/features/lorebook-editor) · [Recursion map](/features/lorebook-editor#recursion-map) · [Map guide](/features/recursion-map-guide)

### CharacterVault 1.2.1

- **Markdown image links** — `![](https://…)` highlighted in the editor; optional click-to-open with a safety warning (**Settings → Studio → Editor links**)
- **Name macros** — `{{char}}` and `{{user}}` get distinct syntax colors
- **Spellcheck** — skips Markdown image constructs; hyphenated compounds pass when each segment is valid

[Release 1.2.1 →](/releases/v1.2.1) · [Editor → Markdown image links](/features/editor#markdown-image-links) · [Spellcheck](/features/editor#spellcheck)

### CharacterVault 1.2.0

- **Custom Context** — free-text notes for the open character (AI Context panel), optional for Orion and the AI toolbar, vault-local only
- **Lorebook** — Enable All / Disable All for context sits next to the entry list
- **Sampler** — modern Creative / Balanced / Factual presets; calmer new-install defaults (streaming & reasoning on, 8K context)

[Release 1.2.0 →](/releases/v1.2.0) · [AI Context → Custom Context](/features/ai-context#custom-context) · [Sampler Settings](/configuration/sampler-settings)

### Custom Context (AI Context panel)

Paste free-text notes for the **current character** and include them in AI work without putting them on the card.

- **AI Context → Custom** — Add / edit in a modal, toggle include, or remove
- **Orion + AI toolbar** — Same block feeds chat and editor ops (when enabled)
- **Vault-local only** — Stored per character in the browser; not in PNG/JSON export or SillyTavern fields
- **Usage meter** — Custom tokens count toward the panel estimate; soft warnings for large pastes

[AI Context → Custom Context](/features/ai-context#custom-context) · [Orion](/features/ai-assistant)

---

## July 2026

### Orion (1.1.0)

- Smoother streaming on long replies; stop mid-reply keeps what Orion already wrote
- Resizable desktop chat panel; scroll follows the stream until you scroll up
- Delete a message (with confirm) and trim everything after it

[AI Assistant →](/features/ai-assistant) · [Release 1.1.0 →](/releases/v1.1.0)

---

### Per-Prompt Model Routing

Each AI toolbar prompt can use its **own endpoint and model**, not only the global AI Config choice.

- **Settings → Prompts** — Expand Enhance, Fix, Rephrase, etc., and set **Model for this prompt**
- **Any preset** — Nano-GPT, Synthetic, OpenRouter, Minimax, LM Studio, or a custom URL you already saved a key for
- **Default stays simple** — Leave an op on **Default (AI Config)** to keep using your global model
- **Examples** — Fast model for Fix, a stronger model for Rephrase, local LM Studio for experiments
- **Lorebook ✨ keys** — Follow the **Custom** prompt mapping when set

Orion chat and AI Creation Studio still use the global AI Config model. The [Agent](/features/ai-agent) has its own mapping on the Prompts tab. Sampler / streaming / reasoning stay global.

Model and provider pickers (AI Config and Prompts) open as mobile-friendly sheets so search is easy on phones.

[AI Setup → Prompts Tab](/configuration/ai-setup#prompts-tab) · [Editor → model routing](/features/editor#per-operation-model-routing)

---

### AI Toolbar Ghost Preview

Toolbar AI edits (Enhance, Rephrase, Custom, and the polish tools) no longer dump a huge result panel over your writing. The suggestion appears **in the editor as ghost text** at the selection — what you see is what Accept inserts.

- **In-place ghost** — Streams into the locked span with a soft glow; soft-pulses when ready
- **Compact chrome** — Status, Accept / Reject, and optional thinking stay in a thin strip; thinking is collapsed by default
- **Clean decisions** — Typing is paused while a suggestion is open so Accept is one undo step; saves wait until you Accept, Reject, or cancel
- **Toast on Accept** — A short success toast confirms the edit (no jarring green highlight flash)
- **Shortcuts** — `Ctrl+Enter` / `⌘+Enter` to Accept, `Escape` to Reject or Stop

[Text editor → AI toolbar](/features/editor#ai-toolbar)

---

### NanoGPT Balance & Subscription

When the **Nano-GPT** preset is selected, a **NanoGPT Account** card in **Settings → AI Config** shows:

- **Balance** (USD and Nano)
- **Subscription status** (active, grace, or not active)
- **Weekly input tokens** and other quota windows when NanoGPT reports them

Refresh is rate-limited. Closing and reopening Settings soon after reuses the last result so the service isn’t hit again. The card keeps a stable size while loading so the rest of the settings panel doesn’t jump.

::: tip Subscription status
Official hosted app and **localhost** need no worker. Only **self-hosted production** may need a small proxy for weekly tokens / sub status — see [NanoGPT Usage Proxy](/configuration/nanogpt-usage-proxy). Balance works everywhere without a proxy.
:::

[AI Setup → NanoGPT Account](/configuration/ai-setup#nanogpt-account-overview)

---

### Reasoning Effort Levels & Compatibility

**Settings → AI Config → Advanced Options** now offers a fuller **Reasoning Effort** ladder when **Enable reasoning** is on: Minimal, Low, Medium, High, Extra high, and Max.

- **GPT-style models** often use Minimal through High, with Extra high as the peak
- **Many SOTA thinking models** (DeepSeek V4, GLM-5.x, Kimi, and similar) mainly use High and Max
- If a provider rejects an effort value or some optional sampler knobs, CharacterVault **adjusts and retries** instead of failing the whole request, and remembers what that model accepted for the session

[Reasoning Effort guide →](/configuration/reasoning-effort)

---

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

# Frequently Asked Questions

## General

::: details What is Character Vault?
Character Vault is a browser-based tool for creating, editing, and organizing roleplay character cards. It supports the V2/V3 character card specification and runs entirely locally — no account, no cloud, no data leaves your machine. It is compatible with SillyTavern and similar tools.
:::

::: details Do I need to install anything?
No. You can use the hosted version at **[https://spaceman2408.github.io/CharacterVault](https://spaceman2408.github.io/CharacterVault)** directly in your browser. No installation required.

If you prefer to run locally or develop on the codebase, see the [Installation guide](/getting-started/installation).
:::

::: details Does the editor have spellcheck?
Yes. The shared editor runs a Hunspell-backed spellchecker (the same engine LibreOffice uses) with an English dictionary bundled. Misspelled words get a wavy-red underline; hover one to see up to eight suggested corrections, click **Ignore word** to skip it for yourself, or click **Add to dictionary** to never have it flagged again. Both the ignore list and your personal dictionary persist in your settings and apply across all your cards.

The checker automatically skips code fences (`` ``` ``), inline `` `code` `` spans, `{{macro}}` placeholders, Markdown image constructs, URLs/emails, HTML tags, numeric tokens, and ALL-CAPS acronyms — so JSON in Extensions and macros in Greetings won't be wrongly flagged. Hyphenated compounds pass when each segment is a valid word.

Toggle it on or off in **Settings → Studio → Spellcheck**. The English dictionary is fetched once on first use and cached locally, so it works offline. Additional languages can be added by bundling new `.aff`/`.dic` pairs.

[Learn more →](/features/editor#spellcheck)
:::

::: details Can I open Markdown image links from the editor?
Yes. Syntax like `![alt](https://…)` is always highlighted. To open the URL on click, enable **Settings → Studio → Editor links → Open Markdown image links on click**. You’ll get a leave-app safety warning first. Drag to select text without opening.

[Learn more →](/features/editor#markdown-image-links)
:::

::: details What can I do with Character Vault?
You can:

- **Edit every field** of a V2/V3 character card: description, personality, greetings, lorebook, creator notes, and extensions
- **Keep standalone lorebooks** in a second vault library (World Info), with import/export, snapshots, and optional linking to characters (linked books stay in sync)
- **Use AI to help you write** through Orion (chat), the **Agent** (writes the open card or lorebook), and an AI toolbar with enhance, rephrase, shorten, fix, and other operations
- **Save snapshots** at any point and roll back to previous versions, either the entire card or individual sections
- **Import and export** PNG cards with embedded data and JSON files, compatible with SillyTavern, TavernAI, and other tools
- **Stay in control** with local IndexedDB storage, dark and light themes
:::

::: details What is the Lorebook Vault?
The home screen has a **Lorebooks** tab for standalone SillyTavern-compatible world-info books. You can create, import, export, duplicate, snapshot, and edit them without opening a character.

A character can **link** one library book. Several characters can share the same book. After you link, you’ll be asked whether to copy that book onto the character. From then on they stay in sync: **Open in vault** updates the library book from the character; edits in the Lorebooks workspace update every linked character. Exporting a card includes the lorebook on that character, not the link itself. **Detach** if you want a character to stop following the library book.

[Lorebook Vault →](/features/lorebook-vault) · [Lorebook Editor →](/features/lorebook-editor)
:::

::: details What is the recursion map?
In the lorebook editor, **Options → Map** (or book settings **Map**) shows which entries can unlock others via recursive scanning: if one entry’s content mentions another’s primary keys. From the map you can inspect unlock paths, edit those keys as chips (writes to the real entry), and bulk-set Non-recursable / Prevent further / Delay until recursion. It is an authoring aid, not a full SillyTavern runtime simulator.

[Lorebook Editor → Recursion map](/features/lorebook-editor#recursion-map)
:::

## AI Features

::: details How do I enable AI features?
To use the AI toolbar, Orion, or the Agent, you must configure an AI provider:

1. Open a character in the workspace
2. Click **Settings** in the workspace header
3. Go to the **AI Config** tab
4. Enter your API Base URL, API Key, and select a model
5. Click **Save Settings**

For step-by-step instructions, see [AI Setup](/configuration/ai-setup).
:::

::: details Which AI providers can I use?
Character Vault works with any OpenAI-compatible endpoint. Presets are available for:

- **Nano-GPT** — hosted endpoint with provider selection
- **Synthetic** — hosted endpoint with `syn:` aliases and a live usage card
- **OpenRouter** — multi-model gateway with key spend and optional spending cap
- **Minimax** — OpenAI-compatible endpoint
- **LM Studio / localhost** — local inference
- **Custom URL** — any compatible endpoint

Each preset saves your API key and model selection separately, so switching between providers restores your saved credentials.
:::

::: details What does the AI toolbar do?
The AI toolbar sits at the top of every text editor and offers several operations:

| Operation | Function |
| :--- | :--- |
| **Enhance** | Elaborate on selected text with more detail |
| **Rephrase** | Rewrite while preserving meaning |
| **Custom** | Type your own instruction for the AI |
| **Shorten** | Condense the selection |
| **Lengthen** | Extend with additional content |
| **Vivid** | Apply descriptive language |
| **Emotion** | Enhance emotional expression |
| **Fix** | Grammar and clarity improvements |

Suggestions preview **in the editor as ghost text** at your selection. Accept (`Ctrl+Enter` / `⌘+Enter`) commits the edit; Reject (`Escape`) keeps the original.

See [Text Editor → AI Toolbar](/features/editor#ai-toolbar) for details.
:::

::: details What is Orion?
Orion is a built-in AI assistant that helps you brainstorm, write, and refine character content. You choose what Orion can see as context (pinned card sections and optional custom notes), then chat with it directly.

To use Orion:

1. Open the **AI Context** panel and select which sections the AI can see (and optionally add [custom context](/features/ai-context#custom-context))
2. Open the **Ask AI** panel and type your question
3. Orion responds using the selected context

Orion uses your configured AI provider and understands Character Vault's features and the V2/V3 specification. See [AI Assistant Orion](/features/ai-assistant).
:::

::: details What is the Agent?
The **Agent** is a chat that **writes** the character or lorebook you have open. You ask for a fill or a revision; when the run finishes, those fields and entries update. Orion does not do that.

1. Open **Ask AI** and click **Agent** in the chat header
2. Optionally enable [custom context](/features/ai-context#custom-context) as source notes
3. Send a request. Changes appear when the run finishes
4. Use **Snapshots** if you need to roll back

It can use a separate model on **Settings → Prompts → Agent**. Set **Settings → Studio → Chat panel** to **Agent** if you want Ask AI to open there. See [AI Agent](/features/ai-agent).
:::

::: details What is custom context?
**Custom context** is free-text notes you paste for one character in the **AI Context** panel. When enabled, those notes are sent to Orion, the Agent, and the AI toolbar. Orion and the toolbar also use any pinned card sections; the Agent reads the card with tools and does not use section pins.

- Stored only in this browser, per character (IndexedDB)
- Not part of PNG/JSON export or SillyTavern card data
- Soft token warnings if the block is large; requests still respect your context window

See [AI Context → Custom Context](/features/ai-context#custom-context).
:::

::: details Is my API key secure?
Your API key is stored locally in your browser's storage. It is not sent to Character Vault's servers, but be aware that:

- Malicious browser extensions could potentially access it
- Anyone with physical access to your unlocked computer could access it

You can clear your AI settings at any time from the AI Config tab by clicking **Clear AI Settings**. See [AI Setup → Security Notice](/configuration/ai-setup#security-notice).
:::

::: details What is the NanoGPT sign-in button?
When the **Nano-GPT** preset is selected in Settings → AI Config, you'll see a **Sign in with NanoGPT** button next to the API Key field. It signs you in using OAuth with PKCE (Proof Key for Code Exchange):

1. Click the button — a new window/tab opens to NanoGPT.
2. Approve the request on NanoGPT's site.
3. CharacterVault exchanges the approval for an API key and drops it into the API Key field.
4. Your available models are auto-fetched and the model picker is populated.

Your NanoGPT password is never seen by CharacterVault, and no client secret is stored in the app. You can still paste an API key manually at any time — the two flows are interchangeable.

::: warning Browser popups must be allowed
The flow opens a new window or tab. If your browser blocks popups for this site, the button will appear to do nothing. Allow popups for your CharacterVault origin and try again.

::: warning Mobile browser support
Works on **Chrome for Android**. Other mobile browsers may not relay the authorization code back to the app correctly. If sign-in doesn't complete on your phone, paste your NanoGPT API key into the API Key field manually.
See [AI Setup → Sign in with NanoGPT](/configuration/ai-setup#sign-in-with-nanogpt-pkce) for the full walkthrough.
:::

## Import & Export

::: details What file formats can I import?
Character Vault accepts:

- **PNG images** — character cards with embedded metadata (from SillyTavern, TavernAI, etc.)
- **JSON files** — flat V2, wrapped V2/V3, or CharacterVault's own export format

For PNG files, the data is stored in a special metadata chunk inside the image. CharacterVault reads this chunk, parses the JSON, and creates a new character with the image as its avatar.
:::

::: details How do I export a character?
Open a character and click **Export** in the toolbar. You have two options:

- **PNG** — embeds all data as V3 specification in the image file. Most versatile — works with SillyTavern, CharacterVault, and other compatible apps.
- **JSON** — exports using V3 specification. Includes name, description, personality, scenario, greetings, lorebook, creator information, tags, and notes (but not the character image).

See [Import & Export](/features/import-export) for details.
:::

::: details Can I import directly from SillyTavern?
Yes, there are several ways:

**Option 1: SillyTavern CharacterVault Export Extension**

A browser extension that adds "Export to CharacterVault" to SillyTavern's export menu. When you use it, the extension copies the character to your clipboard in a format CharacterVault understands — no need to save files manually.

**Option 2: Clipboard Import**

1. In SillyTavern, copy a character to the clipboard
2. Open Character Vault and navigate to the **Import** page (or use the `/import` route directly)
3. Paste the character data to import it

See [Installation → SillyTavern Integration](/getting-started/installation#sillytavern-integration).
:::

## Snapshots & History

::: details How do snapshots work?
Every character card maintains a local snapshot history. When you open a character, a baseline snapshot is created automatically. You can also create manual snapshots at any time to save your progress.

To access snapshots:

1. Open a character in the workspace
2. Click **Snapshots** in the workspace header
3. Browse the timeline and select a snapshot to compare with your current draft

You can restore the entire card or restore individual sections. Each restore automatically creates a rollback snapshot so you can undo if needed. See [Snapshots & Rollback](/features/snapshots-history).
:::

::: details What types of snapshots exist?

| Badge | When It's Created |
| :--- | :--- |
| **Opened card** | Automatically the first time you open a character card. Only one baseline exists per character; it is protected from deletion. It stays last in the list. |
| **Manual save point** | When you click **Save snapshot** in the Snapshots modal. |
| **Post-restore save point** | Automatically after a restore (full card or section) completes. This records the state right after the rollback is applied. |

You may occasionally see a **"Legacy auto save point"** badge on older snapshots. These were created automatically by an earlier version of the app. No new auto snapshots are created in the current version.
:::

::: details How many snapshots can I keep?
Each character is limited to 10 saved snapshots (not including the baseline "Opened card" snapshot). When the limit is exceeded, the oldest ones are removed automatically.

Storage notes:

- If nothing has changed since the latest snapshot, a new one won't be created
- Snapshot images are memory-optimized — they only store image data when the image actually changed
- Snapshots are local; clearing browser data removes all snapshot history
:::

## Storage & Data

::: details Where is my data stored?
All character data is stored locally in your browser using IndexedDB. No data is sent to external servers. This includes character cards and images, snapshot history, AI configuration and settings, and UI preferences.
:::

::: details What happens if I clear my browser data?
::: warning What happens when you clear your browser data:
Your cache, local storage, IndexedDB will remove all your characters, settings, and snapshot history.

::: danger BACKUP YOUR CHARACTERS
For important characters, export a PNG backup before clearing browser data. See [Import & Export](/features/import-export).
:::

::: details Can I use Character Vault offline?
The app works offline. You can create, edit, organize, import, and export characters without an internet connection.

AI features (Orion, Agent, and AI toolbar) require an internet connection to reach your configured API endpoint.
:::

## Troubleshooting

::: details The Agent’s tool calls fail or it never writes the card
The Agent needs a **current tool-calling / agentic** model. A small chat model, a roleplay finetune, or last year’s instruct weights will invent broken calls or dump prose instead of editing. That is the model, not a CharacterVault setting.

Use something in the **Qwen3.8 / DeepSeek V4 / GLM-5.3 / Kimi K3** class (or current GPT / Claude via a gateway). **Qwen3.8-27B** is a compact hosted example that handles this Agent well. Local works too if the model was trained for tools. **Gemma 4** (including **E2B** / **E4B**) is a real option. Bigger parameters with tool-call training are still more reliable on large jobs. Map Agent on **Settings → Prompts → Agent** so Orion can stay on a cheaper chat model.

[AI Agent → Troubleshooting](/features/ai-agent#troubleshooting)
:::

::: details The AI toolbar buttons are disabled
This typically means one of two things:

- **No AI provider configured** — See [AI Setup](/configuration/ai-setup) to configure a provider.
- **Selection too long** — The selected text exceeds the AI's context window. Either select less text or increase the Context Length setting in Settings → Sampler tab.
:::

::: details My API requests are failing
Common causes include:

- **Missing /v1 in URL** — If your base URL doesn't end in `/v1`, the error message will suggest adding it. This is a common configuration mistake with OpenAI-compatible endpoints.
- **Invalid API key** — Verify your key is correct and hasn't expired. Check your provider's dashboard for status.
- **Wrong model** — Ensure the model ID matches what your provider offers. Use the **Fetch** button in Settings to see available models.
- **Context length too small** — If you're sending too much content, increase the Context Length in Settings → Sampler tab.

See [AI Setup → Troubleshooting](/configuration/ai-setup#troubleshooting-context-warnings) for more.
:::

::: details The context window is too small warning
This appears when your content exceeds the configured context length. Solutions:

- Select less text for AI operations
- Increase **Context Length** in Settings → Sampler tab
- Decrease **Max Tokens** to leave more room for input

The system reserves a 100-token safety margin automatically.
:::

::: details Can I customize the AI prompts?
Yes, all eight toolbar operation prompts are customizable:

1. Open **Settings** in the workspace header
2. Go to the **Prompts** tab
3. Edit the prompt template for any operation

Each prompt must include `${text}` as a placeholder (the selected or full editor content). The Custom operation also requires `${instruction}`. See [Text Editor → Customizing AI Operation Prompts](/features/editor#customizing-ai-operation-prompts).
:::

::: details Can each toolbar button use a different model?
Yes. On **Settings → Prompts**, expand any operation and set **Model for this prompt**. You can keep **Default (AI Config)** or point that op at another endpoint (Nano-GPT, Synthetic, OpenRouter, Minimax, LM Studio, custom) and model. Keys are configured on the **AI Config** tab first.

Orion chat and AI Creation Studio always use the global AI Config model. The **Agent** uses the **Agent** mapping at the top of the Prompts tab (Default follows AI Config). Lorebook ✨ key generation follows the **Custom** prompt mapping when set.

See [AI Setup → Per-prompt model routing](/configuration/ai-setup#per-prompt-model-routing) and [Editor → Per-operation model routing](/features/editor#per-operation-model-routing).
:::

::: details The NanoGPT sign-in button does nothing
Your browser is most likely blocking the popup that opens NanoGPT's authorization page. Click the popup-blocker icon in your browser's address bar and allow popups for this site, then click **Sign in with NanoGPT** again. On mobile, prefer Chrome — other mobile browsers may not relay the authorization code back to the app, in which case paste your API key manually into the API Key field instead.
:::

::: details How do I report a bug or request a feature?
Visit the [Character Vault GitHub repository](https://github.com/spaceman2408/CharacterVault) to open an issue.
:::

## Privacy

::: details Is Character Vault private? Where is my data stored?
Yes for core use: character cards and settings stay in **your browser** (IndexedDB and related local storage). There is no CharacterVault account and no CharacterVault cloud library.

Optional AI features send the content you choose to the **AI provider you configure**. The public site is hosted on GitHub Pages, which may process normal website access logs under GitHub’s policies.

See the full [Privacy](/privacy) notice for details.
:::
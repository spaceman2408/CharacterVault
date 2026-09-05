# Text Editor

Every text field in Character Vault uses a **CodeMirror 6** editor — a fast, keyboard-friendly editor with AI tools built directly into the toolbar.

::: tip
AI toolbar operations require an AI provider to be configured. If you haven't set one up, see [AI Setup](/configuration/ai-setup).
:::

## AI Toolbar

A fixed toolbar sits at the top of every editor. When you select text, the AI buttons become active.

### Primary Operations

These are always visible in the toolbar:

| Button | Operation | What It Does |
| :--- | :--- | :--- |
| ✨ **Enhance** | Expand | Elaborate on the selected text with more detail |
| 🔄 **Rephrase** | Rewrite | Rewrite the selection while preserving the meaning |
| 💬 **Custom** | Instruct | Type your own instruction for the AI to apply |

The **Custom** button opens an inline text input instead of running immediately. Type your instruction, then press **Enter** or click **Send**. Press **Escape** or **Cancel** to close it without running.

::: tip Multi-line Input
All AI toolbar inputs support multi-line text. Press **Shift+Enter** to insert line breaks when writing detailed custom instructions.
:::

::: tip
Custom works even without a selection — you can give instructions about the whole section. For example, type "add more detail" to enhance the entire field at once.
:::

### Polish Operations

Click **▼ More** to reveal a dropdown with additional operations:

| Button | Operation | What It Does |
| :--- | :--- | :--- |
| ✂️ **Shorten** | Shorten | Condense the selected text |
| 📄 **Lengthen** | Lengthen | Extend the selection with additional content |
| 🎨 **Vivid** | Vivid | Apply vivid, descriptive language |
| ❤️ **Emotion** | Emotion | Enhance emotional expression |
| 🪄 **Fix** | Grammar | Fix grammar and improve clarity |

### AI Operation Results (Ghost Preview)

AI suggestions appear **in the editor** as glowing ghost text at the exact place your selection was — a 1:1 preview of what Accept will write. The original selection is hidden for the preview and restored if you Reject. The top toolbar stays compact: status, optional thinking, and Accept / Reject.

**While the AI is working**

- Ghost text streams into place (calm, dim styling while tokens arrive).
- The editor is **read-only for typing** so the preview stays a clean undo step — you can still scroll and move the caret to read context.
- A **⏹ Stop** control replaces the main action buttons. Click it (or press `Escape`) to cancel. There is no extra ✕ while it is running.

**When the suggestion is ready**

- Ghost text soft-pulses so you can tell it is ready to decide.
- Accept / Reject appear in the slim result strip under the toolbar.
- Optional performance stats (TTFT, T/S) show in that strip when available.

**Accept or Reject**

- **✓ Accept** (`Ctrl+Enter` / `⌘+Enter`) — Commits the ghost text into the document at the locked range. A short success toast confirms the edit. `Ctrl+Z` / `⌘+Z` undoes just that accept.
- **✕ Reject** (`Escape`) — Discards the ghost and restores your original text.

The replace target is **locked** when the operation starts. Document saves are held until you Accept, Reject, or cancel, so unaccepted AI text is never written to storage.

**Selection Info**

When text is selected (before you run an operation), the right side of the toolbar can show a character count. If your selection is too long for the AI's context window, a warning appears and the buttons are disabled.

**Reasoning**

If the AI model produces reasoning (thinking) output, a collapsible **Thinking** fold appears in the compact result strip (same control as Orion and the Agent). It stays **collapsed by default** — expand it only if you want to read the thinking.

If the operation **errors**, a **✕** appears on the result strip to dismiss it (`Escape` also dismisses).

## Search & Replace

Click the 🔍 button in the toolbar, or press `Ctrl+F` / `Cmd+F`.

- **Find** — Type in the search field. Matches are highlighted in the editor.
- **Navigate** — Use the **^** and **v** buttons (or `Enter` / `Shift+Enter`) to jump between matches.
- **Replace** — Type a replacement string and use **Replace** (current match) or **Replace All**.
- **Options** — Toggle **Aa** (case-sensitive), **ab** (whole word), or **.*** (regular expression).
- **Match counter** — Shows the current match index and total count (e.g., "3/12").
- **Close** — Press `Escape` or click **×**.

If you have text selected when opening search, it automatically fills the search field.

## Font Size

Click the **aA** button in the toolbar to open a font size slider.

- Drag the slider to adjust size (6px – 32px).
- The size updates on release and is remembered across sections.
- The slider popup closes when you click outside it.

## Normalize HTML Entities

Click the **;&** button in the toolbar to normalize HTML entities into readable characters.

- If text is selected, only the selection is normalized.
- If nothing is selected, the whole editor document is normalized.
- Useful when imported cards contain text like `&nbsp;`, `&amp;`, `&quot;`, or numeric entities.

::: tip
This is available in every text editor that uses the shared CodeMirror toolbar, including standard fields, Greetings, Lorebook entry content, Creator Notes, and Extensions.
:::

## Editor Features

- **Spellcheck** — A custom in-editor spellchecker (Hunspell-backed) underlines
  misspellings and offers quick-fix suggestions. Toggle on/off and pick the
  language from **Character Workspace → Spellcheck** in Settings. The English dictionary is
  fetched from `/dictionary/en.{aff,dic}` on first use and cached in IndexedDB
  for offline access. Hover or focus over a flagged word to see suggestions
  plus "Ignore word" and "Add to dictionary".
- **Name macros** — `{{char}}` and `{{user}}` are syntax-colored so they stand
  out while you write (case-insensitive; optional spaces inside the braces).
- **Markdown image links** — Image syntax is highlighted; optional click-to-open
  is controlled under **Settings → Character Workspace → Editor links**.

### Markdown image links

Markdown image syntax such as `![alt](https://example.com/art.png)` is
highlighted in every shared text editor.

- **Highlight** — Always on so image marks and URLs are easy to spot.
- **Click to open** — When **Settings → Character Workspace → Editor links → Open Markdown
  image links on click** is enabled, clicking an openable `http`/`https` URL
  shows a leave-app safety warning, then opens the link in a new tab.
- **Select without opening** — Drag to select text; a small movement cancels
  the click-open action.
- **Spellcheck-friendly** — Image constructs are skipped by spellcheck so
  URLs and alt text don’t pile up wavy underlines.

### Name macros

`{{char}}` and `{{user}}` (and spaced forms like `{{ char }}`) get distinct
colors in the editor. Matching is case-insensitive so `{{Char}}` and
`{{USER}}` highlight the same way.

### Spellcheck

The shared editor runs a Hunspell-backed spellchecker — the same engine LibreOffice
and most browsers use. It's enabled by default for every section that uses the
shared toolbar: Description, Personality, Scenario, Greetings, Lorebook entry
content, Creator Notes, and Extensions.

How it works:

- **Underlines** — Misspelled words get a wavy red underline. Hovering shows a
  tooltip with up to eight suggestions, plus **Ignore word** and **Add to
  dictionary**.
- **Language-aware in technical sections** — Creator Notes (HTML) and
  Extensions (JSON) automatically skip technical tokens that aren't prose:
  HTML element names, attribute names, attribute values, and JSON property
  keys (e.g. `full_path`, `class="sora-preview"`). The text between tags and
  the JSON string _values_ are still checked.
- **Affix-aware** — `running`, `ran`, and `runs` all pass without you needing to
  whitelist anything.
- **Hyphenated compounds** — Words like `well-known` pass when each segment is
  a valid dictionary word.
- **Smart ignores** — The checker automatically skips ` ``` ` code fences, inline
  `` `code` `` spans, `{{macro}}` placeholders, Markdown image constructs,
  HTML tags, URLs/emails, numeric tokens, and ALL-CAPS acronyms. Add more words
  to your **ignored** or **personal dictionary** lists from the tooltip; they
  persist in your settings and apply across all cards.
- **Debounced + viewport-only** — Only the visible portion of large lorebooks
  is checked, so editing stays fast.
- **Offline** — The English Hunspell dictionary is fetched once on first use
  and cached in IndexedDB for subsequent visits.

Toggle or switch language in **Settings → Character Workspace → Spellcheck**. Currently the
only bundled language is **English (en-US)**; additional languages can be added
by dropping `public/dictionary/<lang>.aff` and `public/dictionary/<lang>.dic`
into the project and listing the code in
`src/editor/spellcheck/dictionary.ts`.
- **Undo/Redo** — Standard `Ctrl+Z` / `Ctrl+Shift+Z` support.
- **Line wrapping** — Long lines wrap automatically.
- **Theme sync** — The editor follows the app's dark/light mode.
- **Auto-save** — Changes are saved as you type. No manual save needed.

## Section Layout

Each section tab shows a title, description, and the editor. Some sections have special layouts:

| Section | Layout |
| :--- | :--- |
| **Name** and **Creator** | Simple text fields for quick edits |
| **Tags** | Tag chips with quick add, paste, and remove controls |
| **Description**, **Personality**, **Scenario**, etc. | Standard single editor |
| **Creator Notes** | Editor with a **Preview CSS** button — opens a sandboxed preview modal, or click again for a side-by-side split view. See [Creator Notes Preview](/features/creator-notes). |
| **Greetings** | Special multi-greeting editor. See [Creating & Editing Characters](/getting-started/creating-characters). |
| **Lorebook** | Two-panel editor with ST fields, recursion map, search, and AI key generation. Same UI for embedded books and the [Lorebook Vault](/features/lorebook-vault). See [Lorebook Editor](/features/lorebook-editor). |
| **Image** | Image upload panel (not a text editor) |
| **Extensions** | Raw JSON editor |

## Name, Creator, and Tags

Some short fields use simpler editors instead of the full writing toolbar:

- **Name** — Type the character name directly.
- **Creator** — Type the creator name directly.
- **Tags** — Add tags with **Enter**, commas, or paste. Remove a tag with its **x** button.

Tags are cleaned up as you add them. Empty tags are ignored, extra spaces are removed, and duplicates are skipped.

## Customizing AI Operation Prompts

All eight toolbar operation prompts are customizable, and each one can optionally use a **different AI endpoint and model** than your global AI Config selection.

1. Open **Settings** in the workspace header.
2. Go to the **Prompts** tab.
3. Expand an operation, edit the template, and (optionally) set **Model for this prompt**.
4. Click **Save Settings**.

### Required Placeholders

Prompts must include certain placeholders to work. The system validates these before saving.

| Placeholder | Used In | Purpose |
| :--- | :--- | :--- |
| `${text}` | All operations | The selected or full editor content |
| `${instruction}` | Custom only | The custom instruction text |

::: info What is a placeholder?

A **placeholder** is a special token that gets replaced with actual content before the prompt is sent to the AI provider.

**Example:** In the template `Enhance the following text: ${text}`, the placeholder is replaced with your selection when you click **Enhance**.
:::

**Primary prompts** (Enhance, Rephrase) need `${text}`. **Polish prompts** (Shorten, Lengthen, Vivid, Emotion, Fix) also need `${text}`.

**Custom** is special — it needs both `${instruction}` and `${text}`. When the editor has content, your template is used. When it's empty, the system swaps in a generation template instead.

::: details How Custom works with empty editors
When the editor is empty, the system swaps the entire prompt template for a generation-oriented one. This lets the Custom button work both as a text modifier **and** a text generator.

**Default Custom template (with editor content):**
```
Please apply the following instruction to the text below:

Instruction: ${instruction}

Text:
"""
${text}
"""

Provide only the modified text without any additional commentary.
```

**When the editor is empty**, the template is replaced entirely:
```
Please generate text based on the following instruction:

Instruction: <your instruction>

Provide only the generated text without any additional commentary.
```

::: warning Not yet customizable
The empty-editor prompt is currently hardcoded and cannot be edited in the Prompts tab. Customization for this prompt is planned for a future release.
:::

> Don't worry if you forget — you can't save a prompt without the required placeholders. An error message will remind you to include them.

### Per-operation model routing

By default every toolbar op uses the model from **Settings → AI Config**. You can override that per prompt:

1. Expand a prompt (e.g. **Fix**).
2. Under **Model for this prompt**, change **Endpoint** from **Default (AI Config)** to Nano-GPT, Synthetic, OpenRouter, Minimax, LM Studio, or a custom URL that already has a key on AI Config.
3. Choose a model from the sheet, **Fetch models** for that endpoint, or type a model ID.
4. Save settings.

Collapsed headers show `→ model-id` when a mapping is active.

| Operation | Mapping key |
| :--- | :--- |
| Enhance | expand |
| Rephrase | rewrite |
| Custom | instruct (also used by lorebook AI key generation) |
| Shorten / Lengthen / Vivid / Emotion / Fix | matching polish op |

**Not overridden by these mappings:** Orion chat and AI Creation Studio always use the global AI Config model. Streaming, reasoning, and sampler settings stay global.

Full setup notes: [AI Setup → Prompts Tab](/configuration/ai-setup#prompts-tab).

## Next Steps

- [Lorebook editor](/features/lorebook-editor)
- [Lorebook Vault](/features/lorebook-vault)
- [Creator Notes preview](/features/creator-notes)
- [AI Assistant Orion](/features/ai-assistant)
- [AI Agent](/features/ai-agent)
- [Configure AI provider](/configuration/ai-setup)
- [Customize section tab layout](/configuration/section-layout)

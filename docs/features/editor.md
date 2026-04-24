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

::: tip
Custom works even without a selection — you can give instructions about the whole section. For example, type "add more detail" to enhance the entire field at once.
:::

## Polish Operations

### Polish Operations

Click **▼ More** to reveal a dropdown with additional operations:

| Button | Operation | What It Does |
| :--- | :--- | :--- |
| ✂️ **Shorten** | Shorten | Condense the selected text |
| 📄 **Lengthen** | Lengthen | Extend the selection with additional content |
| 🎨 **Vivid** | Vivid | Apply vivid, descriptive language |
| ❤️ **Emotion** | Emotion | Enhance emotional expression |
| 🪄 **Fix** | Grammar | Fix grammar and improve clarity |

### Selection Info

When text is selected, the right side of the toolbar shows the character count. If your selection is too long for the AI's context window, a warning appears and the buttons are disabled.

### Accept or Reject

After an AI operation finishes, a result panel appears below the toolbar showing the AI's output:

- **✓ Accept** — Replaces your selection with the AI result.
- **✕ Reject** — Discards the AI result and keeps your original text.

::: tip
Accepted text gets a brief green highlight so you can spot what changed. It fades after a moment.
:::

### Stop

While an AI operation is running, a **⏹ Stop** button replaces the toolbar buttons. Click it to cancel the request.

### Reasoning

If the AI model produces reasoning (thinking) output, a collapsible **"✨ Thinking process"** section appears in the result panel. It auto-expands during streaming and can be toggled after the operation completes.

## Search & Replace

Click the 🔍 button in the toolbar, or press `Ctrl+F` / `Cmd+F`.

- **Find** — Type in the search field. Matches are highlighted in the editor.
- **Navigate** — Use the **^** and **v** buttons (or `Enter` / `Shift+Enter`) to jump between matches.
- **Replace** — Type a replacement string and use **Replace** (current match) or **Replace All**.
- **Options** — Toggle **Aa** (case-sensitive), **ab** (whole word), or **.\*** (regular expression).
- **Match counter** — Shows the current match index and total count (e.g., "3/12").
- **Close** — Press `Escape` or click **×**.

If you have text selected when opening search, it automatically fills the search field.

## Font Size

Click the **aA** button in the toolbar to open a font size slider.

- Drag the slider to adjust size (6px – 32px).
- The size updates on release and is remembered across sections.
- The slider popup closes when you click outside it.

## Editor Features

- **Spellcheck** — Native browser spellcheck is enabled.
- **Undo/Redo** — Standard `Ctrl+Z` / `Ctrl+Shift+Z` support.
- **Line wrapping** — Long lines wrap automatically.
- **Theme sync** — The editor follows the app's dark/light mode.
- **Auto-save** — Changes are saved as you type. No manual save needed.

## Section Layout

Each section tab shows a title, description, and the editor. Some sections have special layouts:

| Section | Layout |
| :--- | :--- |
| **Description**, **Personality**, **Scenario**, etc. | Standard single editor |
| **Creator Notes** | Editor with a **Preview CSS** button — opens a sandboxed preview modal, or click again for a side-by-side split view. See [Creator Notes Preview](/features/creator-notes). |
| **Greetings** | Special multi-greeting editor. See [Creating & Editing Characters](/getting-started/creating-characters). |
| **Lorebook** | Two-panel editor with search and AI key generation. See [Lorebook Editor](/features/lorebook-editor). |
| **Image** | Image upload panel (not a text editor) |
| **Extensions** | Raw JSON editor |

## Customizing AI Prompts

All eight toolbar operation prompts are customizable:

1. Open **Settings** in the workspace header.
2. Go to the **Prompts** tab.
3. Edit the prompt template for any operation.

- **Primary prompts** (Enhance, Rephrase, Custom) — The Custom prompt needs `${text}` and `${instruction}` placeholders.
- **Polish prompts** (Shorten, Lengthen, Vivid, Emotion, Fix) — Each needs a `${text}` placeholder.

Validation errors appear inline if a required placeholder is missing.

## Next Steps

- [Lorebook editor](/features/lorebook-editor)
- [Creator Notes preview](/features/creator-notes)
- [AI Assistant — Orion](/features/ai-assistant)
- [Configure AI provider](/configuration/ai-setup)

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

### AI Operation Results

After an AI operation finishes, a result panel appears below the toolbar showing the AI's output.

**Selection Info**

When text is selected, the right side of the toolbar shows the character count. If your selection is too long for the AI's context window, a warning appears and the buttons are disabled.

**Accept or Reject**

- **✓ Accept** — Replaces your selection with the AI result.
- **✕ Reject** — Discards the AI result and keeps your original text.

::: tip
Accepted text gets a brief green highlight so you can spot what changed. It fades after a moment.
:::

**Stop**

While an AI operation is running, a **⏹ Stop** button replaces the toolbar buttons. Click it to cancel the request.

**Reasoning**

If the AI model produces reasoning (thinking) output, a collapsible **"✨ Thinking process"** section appears in the result panel. It auto-expands during streaming and can be toggled after the operation completes.

**Performance Stats**

When an AI operation completes, performance metrics appear in the top-right corner of the result panel:

- **TTFT** — Time to First Token. How long the AI took to start responding (in milliseconds). Lower is better.
- **T/S** — Tokens per Second. How fast the AI generated tokens after the first one. Higher is better.

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

## Next Steps

- [Lorebook editor](/features/lorebook-editor)
- [Creator Notes preview](/features/creator-notes)
- [AI Assistant — Orion](/features/ai-assistant)
- [Configure AI provider](/configuration/ai-setup)

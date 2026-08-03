# AI Context Panel

The **AI Context** panel is a docked side panel that lets you control what gets sent to AI-powered features. That includes:

- **Character card sections** you pin (Description, Personality, Scenario, and so on)
- Optional **custom context** — free-text notes you paste for this character

Both feed the **Orion** chat assistant and the **AI toolbar** (Enhance, Rephrase, Shorten, lorebook key generation, and similar ops). Think of the panel as choosing what the AI "sees" when it helps you write or edit.

::: tip
This panel works with your configured AI provider. If you haven't set one up yet, see [AI Setup](/configuration/ai-setup).
:::

## Opening the Panel

The panel lives on the left side of the workspace. Click the **AI Context** button in the workspace header to open or close it. On mobile, it appears as a full-screen overlay with a close button.

## How It Works

From top to bottom the panel shows:

1. **Usage** — estimated tokens for everything currently included (pinned sections + custom context when enabled), against your sampler context length.
2. **Custom** — optional free-text block for this character (see [Custom Context](#custom-context)).
3. **Selected** — chips for card sections currently pinned; **Clear all** removes section pins only.
4. **Section list** — searchable checklist of eligible card sections. Toggle a row to pin or unpin it.

### Available Sections

Not every character field appears in the context panel. These sections are excluded:

- Image (base64 data)
- Extensions
- Avatar URL
- Character version
- Tags

The lorebook appears in the list only if your character actually has lorebook entries.

## Custom Context

**Custom context** is a single free-text block you can paste or type for the **currently open character**. Use it for notes that are not (or not yet) part of the card: world facts, style guides, reference dumps, WIP outlines, or anything else you want Orion and the toolbar to see.

### Adding and editing

1. Open the **AI Context** panel.
2. Under **Custom**, click **Add custom context…** (or the pencil if you already have text).
3. In the modal, paste or type your notes.
4. Leave **Include in AI context when enabled** checked if you want it used on the next request.
5. Click **Save**.

The modal shows a live token estimate and soft warnings when the block is large relative to your context window. Large pastes are allowed; the AI request layer still trims content when the total input exceeds the window.

### Enabling and removing

- **Checkbox** on the Custom row — include or exclude the saved text without deleting it.
- **Remove** — deletes the custom context for this character (confirm first).
- Empty save (clear the textarea and save) also clears storage for that character.

### What uses custom context?

| Surface | Uses custom context when enabled? |
| :--- | :--- |
| Orion (Ask AI) chat | Yes |
| AI toolbar (Enhance, Rephrase, Custom, etc.) | Yes |
| Lorebook ✨ key generation | Yes (same context pipeline as the toolbar) |
| AI Creation Studio | No (studio has its own flow) |

Custom context is appended **after** pinned card sections when building a request, so core card fields take priority if the context window is tight.

### Storage and privacy

- Stored **only in this browser** (IndexedDB), **per character**.
- **Not** written into the character card `spec`, **not** included in PNG/JSON export, and **not** part of SillyTavern-compatible card data.
- **Not** included in snapshots/history of the card.
- Duplicating a character **copies** its custom context to the new card.
- Deleting a character removes its custom context with it.
- Switching characters does not leave the previous character's text in the open editor; the full body is loaded only when you open the modal or when an AI request needs it.

::: warning Export and backup
Vault **Backup** / card export does **not** include custom context. If you rely on those notes, keep a separate copy or re-paste after moving machines. See [Privacy](/privacy) for how local storage works.
:::

## Token Estimation

The panel shows an estimated token count for pinned sections and, when enabled, custom context. It uses a simple formula: text size in bytes divided by 4 (rounded up). This is an approximation — actual token counts vary by model.

The usage bar changes color as you approach the limit:

- Green — under 50% of context limit
- Yellow — between 50% and 80%
- Red — over 80% (shows an over-limit warning)

The context limit comes from your current sampler settings (**Settings → Sampler → Context Length**).

::: tip
The token count shown here is an estimate. Different models tokenize text differently, so your actual usage may be higher or lower. Treat the percentage as a rough guide rather than an exact number.
:::

## Lorebook in Context

Using the lorebook with the AI Context panel works in two steps:

1. **Add Lorebook to context** — In the Add Context section, click "Lorebook" to include it. Without this, no lorebook entries will be included regardless of their individual settings.

::: tip
If you don't see "Lorebook" in the Add Context list, it means your character doesn't have any lorebook entries yet.
:::

2. **Choose which entries** — Once the lorebook is in context, open the lorebook editor. Each entry has an eye icon that controls whether it gets included:
   - Eye open — entry content is sent to Orion and the AI toolbar
   - Eye closed — entry is excluded from AI context

This two-layer system means you can include the entire lorebook but hide specific entries by closing their eye icons. Or keep the lorebook out of AI context entirely while leaving all entries enabled for roleplay in SillyTavern.

### How the Toggles Work Together

Each lorebook entry has two independent settings:

| Toggle | Used By |
| :--- | :--- |
| **Enabled** (main toggle) | SillyTavern and other chat interfaces during roleplay |
| **Context** (eye icon) | Orion and AI toolbar operations |

You might disable certain entries for Orion and the AI toolbar because they're too long, irrelevant to editing, or you'd rather the AI not see them. Meanwhile, those same entries stay enabled for actual roleplay. The settings don't affect each other.

## Next Steps

- [Lorebook Editor](/features/lorebook-editor)
- [Editor & AI Toolkit](/features/editor) — AI toolbar operations
- [AI Assistant — Orion](/features/ai-assistant)
- [Configure AI provider](/configuration/ai-setup)
# AI Context Panel

The **AI Context** panel is a docked side panel that lets you control which character sections get sent to AI-powered features. This includes both the Orion chat assistant and the AI toolbar operations (Enhance, Rephrase, Shorten, etc.). Think of it as a way to hand-pick what the AI "sees" when it helps you write or edit content.

::: tip
This panel works with your configured AI provider. If you haven't set one up yet, see [AI Setup](/configuration/ai-setup).
:::

## Opening the Panel

The panel lives on the left side of the workspace. Click the **AI Context** button in the workspace header to open or close it. On mobile, it appears as a full-screen overlay with a close button.

## How It Works

The panel has two collapsible sections:

**Selected Context** — shows which sections are currently included in AI context, along with a token usage bar. Click the trash icon to clear all selected sections at once.

**Add Context** — browse and search available character sections to add. Click any section to add it to your context. The list automatically hides sections you've already selected.

### Available Sections

Not every character field appears in the context panel. These sections are excluded:

- Image (base64 data)
- Extensions
- Avatar URL
- Character version
- Tags

The lorebook appears in the list only if your character actually has lorebook entries.

## Token Estimation

The panel shows an estimated token count based on the selected sections. It uses a simple formula: text size in bytes divided by 4 (rounded up). This is an approximation — actual token counts vary by model.

The usage bar changes color as you approach the limit:

- Green — under 50% of context limit
- Yellow — between 50% and 80%
- Red — over 80% (shows "Over limit" warning)

The context limit comes from your current sampler settings.

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
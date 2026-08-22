# AI Assistant — Orion

Character Vault includes a built-in AI assistant called **Orion** that helps you brainstorm, write, and refine character content. Orion uses your configured AI provider plus the **context** you choose: pinned card sections and optional [custom context](/features/ai-context#custom-context).

::: tip
Orion requires an AI provider to be configured. See [AI Setup](/configuration/ai-setup) to get connected first.

Orion always uses the **global** model from **Settings → AI Config**. Per-prompt model mappings on the Prompts tab apply to the AI toolbar (and lorebook key generation for Custom). The [Agent](/features/ai-agent) has its own mapping and is a separate chat that **writes** the card or book.
:::

## Opening the AI Panels

The workspace has two docked panels:

- **Context Panel** (left) — Choose which character sections (and optional custom notes) the AI can see.
- **Ask AI Panel** (right) — Chat with the AI assistant.

Both panels can be toggled from the workspace header. In the chat header, **Agent** switches this panel to the writing Agent. Switch it off to come back to Orion. The two threads stay separate.

## Using the Context Panel

Before chatting with Orion, select what the AI should use as background:

1. Open the **AI Context** panel on the left side of the workspace.
2. Check the card sections you want the AI to see — for example, Description, Personality, and Scenario.
3. Optionally add **Custom context** for free-text notes that are not part of the card.
4. Selected sections and enabled custom context are included when you send a message (and when you use the AI toolbar).

This gives Orion the background it needs without sending your entire character card every time. Full panel details: [AI Context Panel](/features/ai-context).

## Chatting with Orion

1. Open the **Ask AI** panel on the right.
2. Type your question or request in the input field.
3. Press **Enter** to send, or **Shift+Enter** to add a new line for multi-line messages.
4. Orion responds — if streaming is enabled, you'll see the output appear in real-time.

::: tip Multi-line Input
The chat input supports multi-line text. Use **Shift+Enter** to insert line breaks when you want to format longer requests or provide structured input to Orion.
:::

Orion uses a fixed system prompt that defines its persona: it knows about Character Vault's features, the V2/V3 character card spec, and is designed to be clear, beginner-friendly, and non-judgmental of all content types.

### Cancelling a Request

You can abort an in-progress request at any time. The current generation stops immediately.

## How Orion Handles Context

When the total input exceeds the context window, Orion prioritizes content in this order:

1. **System prompt** (Orion persona) — always included
2. **Your current question** — always included
3. **Context entries** from the left panel (pinned sections, then custom context) — included until space runs out
4. **Conversation history** — oldest messages are dropped first

See [AI Setup → How Truncation Works](/configuration/ai-setup#how-truncation-works) for details on token estimation and context warnings.

## Reasoning

Orion works with models that output reasoning/thinking content (DeepSeek R1, Qwen/QwQ, OpenAI o1/o3/o4-mini, Gemma 4, etc.). Reasoning is displayed in a collapsible section before the main response.

To enable and configure reasoning, see [AI Setup → Advanced Options](/configuration/ai-setup#advanced-options).

## Next Steps

- [AI Agent](/features/ai-agent) (writes the open card or book)
- [AI Context Panel](/features/ai-context)
- [Configure your AI provider](/configuration/ai-setup)
- [Use the AI toolbar for text operations](/features/editor#ai-toolbar)
- [Adjust sampler settings](/configuration/sampler-settings)

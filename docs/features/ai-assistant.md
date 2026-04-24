# AI Assistant — Orion

Character Vault includes a built-in AI assistant called **Orion** that helps you brainstorm, write, and refine character content. Orion uses your configured AI provider and the character sections you select as context.

::: tip
Orion requires an AI provider to be configured. See [AI Setup](/configuration/ai-setup) to get connected first.
:::

## Opening the AI Panels

The workspace has two docked panels:

- **Context Panel** (left) — Choose which character sections the AI can see.
- **Ask AI Panel** (right) — Chat with the AI assistant.

Both panels can be toggled from the workspace header.

## Using the Context Panel

Before chatting with Orion, select which parts of your character should be included as context:

1. Open the **AI Context** panel on the left side of the workspace.
2. Check the sections you want the AI to see — for example, Description, Personality, and Scenario.
3. The selected sections are included in the AI's context window when you send a message.

This gives Orion the background it needs to give relevant suggestions without sending your entire character card every time.

## Chatting with Orion

1. Open the **Ask AI** panel on the right.
2. Type your question or request in the input field.
3. Orion responds — if streaming is enabled, you'll see the output appear in real-time.

Orion uses a fixed system prompt that defines its persona: it knows about Character Vault's features, the V2/V3 character card spec, and is designed to be clear, beginner-friendly, and non-judgmental of all content types.

### Cancelling a Request

You can abort an in-progress request at any time. The current generation stops immediately.

## How Orion Handles Context

When the total input exceeds the context window, Orion prioritizes content in this order:

1. **System prompt** (Orion persona) — always included
2. **Your current question** — always included
3. **Context entries** from the left panel — included until space runs out
4. **Conversation history** — oldest messages are dropped first

See [AI Setup → How Truncation Works](/configuration/ai-setup#how-truncation-works) for details on token estimation and context warnings.

## Reasoning

Orion works with models that output reasoning/thinking content (DeepSeek R1, Qwen/QwQ, OpenAI o1/o3/o4-mini, Gemma 4, etc.). Reasoning is displayed in a collapsible section before the main response.

To enable and configure reasoning, see [AI Setup → Advanced Options](/configuration/ai-setup#advanced-options).

## Next Steps

- [Configure your AI provider](/configuration/ai-setup)
- [Use the AI toolbar for text operations](/features/editor#ai-toolbar)
- [Adjust sampler settings](/configuration/sampler-settings)

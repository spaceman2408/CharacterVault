# AI Assistant — Orion

Character Vault includes a built-in AI assistant called **Orion** that helps you brainstorm, write, and refine character content. Orion uses your configured AI provider plus the **context** you choose: pinned card sections and optional [custom context](/features/ai-context#custom-context).

::: tip
Orion requires an AI provider to be configured. See [AI Setup](/configuration/ai-setup) to get connected first.

Orion always uses the model set on **Settings → AI Config**. The inline AI toolbar and the [Agent](/features/ai-agent) can each be pointed at a different model on **Settings → Prompts**.
:::

## Which AI feature do I want?

| Feature | Where | What it does |
| :--- | :--- | :--- |
| **Orion** | **Ask AI** panel (chat bubble icon) | Chats about your card. Never edits it; copy its text into a field yourself. |
| **AI toolbar** | Select text in the editor | Rewrites, expands, or fixes the selection in place. See [Editor → AI Toolbar](/features/editor#ai-toolbar). |
| **[Agent](/features/ai-agent)** | **Ask AI** panel (robot icon) | Edits the open card or lorebook for you, with a snapshot first (or a review step). |
| **[AI Creation Studio](/features/ai-creation-studio)** | **AI Create** in the vault header | Generates a new card (name, description, first message, examples) from a concept or tags. |

## Opening the AI Panels

The workspace has two docked panels:

- **Context Panel** (left) — Choose which character sections (and optional custom notes) the AI can see.
- **Ask AI Panel** (right) — Chat with the AI assistant. Its header reads **Ask Orion**, or **Character agent** when the Agent is selected.

Both panels can be toggled from the workspace header. At the left of the chat header, a two-icon switch picks the chat: the chat bubble is Orion and the robot is the writing Agent. The highlighted icon is the one in use. The two threads stay separate, and each is saved on the open character or lorebook.

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

Images in Orion and Agent replies show as **Image: …** links that open on click, so a reply can't load a URL on its own.

### Saved chats

The Orion thread for this character or standalone lorebook is stored in the browser. Close Ask AI, switch cards, or come back later and it is still there. **New chat** asks first, then clears only Orion’s saved thread for this owner — the Agent thread is untouched. Chats are not written into PNG/JSON export. Deleting the character or lorebook deletes its chats with it.

**Load earlier messages** pages older turns back in. The on-screen window stays small; oldest rows drop past 500 saved messages per panel.

### Editing your last message

The pencil on your last message puts its text back in the box. Nothing is removed until you send; then that message and the replies after it are replaced. The **×** cancels and keeps the chat as it was. You can't edit while Orion is replying.

### Message actions

- **Copy** a reply, or a single code block with its own copy button.
- **Regenerate response** asks for a new version of the last reply.
- **Retry** resends your last message; **Send** with an empty box does the same.
- **Delete** removes that message and everything after it. Click twice to confirm.

### Cancelling a Request

Click **Stop** (the square that replaces Send while Orion is replying) to abort. Text that already streamed stays.

## How Orion Handles Context

When the total input exceeds the context window, Orion prioritizes content in this order:

1. **System prompt** (Orion persona) — always included
2. **Your current question** — always included
3. **Context entries** from the left panel (pinned sections, then custom context) — included until space runs out
4. **Conversation history** — oldest messages are dropped first

See [AI Setup → How Truncation Works](/configuration/ai-setup#how-truncation-works) for details on token estimation and context warnings.

## Reasoning

Orion works with models that output reasoning/thinking content (DeepSeek R1, Qwen/QwQ, OpenAI o1/o3/o4-mini, Gemma 4, etc.). Reasoning uses the same **Thinking** fold as the [Agent](/features/ai-agent) and the editor toolbar.

- While a reply is streaming, **Thinking** starts **expanded**
- After the reply, it is collapsed; expand it if you want to read the committed thinking

To enable and configure reasoning, see [AI Setup → Advanced Options](/configuration/ai-setup#advanced-options). The (i) **Response stats** button on a finished reply shows **TTFT** (time to first token), speed in t/s, the model, and the provider.

## Next Steps

- [AI Agent](/features/ai-agent) (writes the open card or book)
- [AI Context Panel](/features/ai-context)
- [Configure your AI provider](/configuration/ai-setup)
- [Use the AI toolbar for text operations](/features/editor#ai-toolbar)
- [Adjust sampler settings](/configuration/sampler-settings)

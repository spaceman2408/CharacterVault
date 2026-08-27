# AI Agent

The **Agent** is a chat that **writes** the open character or lorebook. You ask for a fill, a rewrite, or a cut, and it updates the card (or book) itself. Orion stays the assistant that talks back without changing fields unless you copy from it.

::: tip
The Agent needs an AI provider, same as Orion. See [AI Setup](/configuration/ai-setup).

It can use the **global** model from **Settings → AI Config**, or its own mapping on **Settings → Prompts → Agent**. Toolbars and Orion are separate.
:::

::: warning It writes for real
When a run finishes, changes land in this card or book. A pulsing **Agent writing** label in the workspace header is the cue. Use [Snapshots](/features/snapshots-history) if you need to roll back.
:::

## Orion vs Agent

| | **Orion** | **Agent** |
| :--- | :--- | :--- |
| **Job** | Brainstorm, Q&A, drafts in chat | Fill and revise the open card or book |
| **Writes the card?** | No | Yes, when the run finishes |
| **Context** | Sections you pin, plus optional custom notes | Field and entry catalogs, plus optional custom notes. It reads bodies with tools. |
| **Model** | Always **Settings → AI Config** | **Settings → Prompts → Agent**, or AI Config if you leave Default |
| **Where** | Character workspace and lorebook vault workspace | Same two workspaces, behind the **Agent** toggle |

You can switch back to Orion at any time. The two chats do not share a thread.

To open Agent by default, set **Settings → Studio → Chat panel** to **Agent**. That applies the next time you open a character or lorebook. The header toggle still works for the current session.

## Opening the Agent

### On a character

1. Open the character in the workspace.
2. Open the **Ask AI** panel (right side; header toggle).
3. Click **Agent** in the chat header so it stays on (skip this if Agent is already your Studio default).
4. Type what you want written. **Enter** sends; **Shift+Enter** adds a line.

The left **AI Context** panel still has [custom context](/features/ai-context#custom-context). Section pins hide in Agent mode; they come back when you switch to Orion. The Agent reads the card through tools, so you do not pick Description vs Personality by hand.

### On a standalone lorebook

1. Open a book from the home **Lorebooks** tab.
2. Open the chat panel.
3. Click **Agent**.
4. Ask it to add or revise entries in **this** book.

That lorebook Agent does not edit character spec fields. For description, greetings, and the book **on a card**, use the character Agent.

## What it can write

### Character Agent

| Area | What you can ask |
| :--- | :--- |
| **Card fields** | Name, description, personality, scenario, first message, examples, system prompt, post-history instructions, appearance, creator notes, creator, character version, tags, avatar URL |
| **Alternate greetings** | Add, rewrite, snippet-edit, or delete. **Greeting 1** is the first alternate, same as the [Greetings](/features/greetings-editor) tab. First Message is its own field. |
| **Embedded lorebook** | Add, rename, rekey, rewrite, snippet-edit, or delete entries (name, keys, content, constant) |

### Lorebook Agent

Same lorebook entry tools as above, for the vault book you have open.

### What it does not write

- Portrait **image** (upload that yourself)
- SillyTavern extras such as recursion flags, probability, depth, scan settings, or the Extensions JSON blob
- The whole vault at once (it only sees the open card or book)

New lorebook entries it adds are **not** pinned into Orion or the AI toolbar. Open the entry **eye** if you want them in that context. They still export on the card or book.

If the character has a [linked library book](/features/lorebook-vault#attach-to-a-character-vault-local), lorebook writes on the character Agent also update that library book when the run finishes.

## Custom context

Optional source notes (world bible, outline, paste dump) live in **AI Context → Custom**. Enable the block if you want the Agent to treat it as material. It is still vault-local: not on the PNG/JSON card, not in SillyTavern fields.

The Agent prefers filling empty fields and staying consistent with those notes. You do not have to pin card sections.

Details: [AI Context → Custom Context](/features/ai-context#custom-context).

## How a run works

1. You send a request.
2. The Agent sees **catalogs** (field ids and sizes; lorebook ids, names, and keys) plus custom context if enabled. It reads full bodies only for what it is about to change.
3. It calls tools (list, read, update, replace, add, delete). The chat shows short colored tool lines, not the full field text.
4. When it is done (or you **Stop**), CharacterVault **writes once** and takes **one snapshot** first.

Until that write, the editor keeps the previous text. A pulsing **Agent writing** label in the workspace header is the cue.

Snippet edits match a unique stretch of existing text instead of rewriting the whole field or entry. Matching tolerates quote styles and multi-section spans. If the snippet is not unique, ask it to re-read and copy a longer stretch.

Providers that accept OpenAI-style `tools` use native function calling. If a provider returns 400 on `tools`, CharacterVault remembers that model, retries the turn with XML tool calls in the message, and later runs for that model skip native tools. You do not turn this on separately. The chat header shows a **Native** or **XML** chip for the current model (hover for the same explanation).

Catalogs in the prompt are built at the **start** of the run. After names or keys change, the Agent can list again in that same run. The **next** Send rebuilds catalogs from the saved card.

### What you see in chat

- **Tool lines:** color-coded list / read / write results, including lorebook entry ids. Click a successful write to open that field, greeting, or lorebook entry.
- **Write recap:** speech from a turn that also called tools stays on the message. If there was no speech, **Applied N writes** sits above the tool list.
- **Busy labels:** while a tool is running, the header spinner uses English phrases (`Updating field`) instead of snake_case names.
- **Thinking:** streams in an expanded **Thinking** fold while it is live; after the reply it collapses
- **Live token count:** catalogs, custom context, and the current prompt (including tool results)
- **TTFT / t/s:** on the assistant message info tooltip when the reply finishes, same as Orion
- Lookup-only reads do not add extra assistant turns; those bodies count in the live meter, then drop out of the transcript

Long threads keep the last **100** messages in the panel so the tab stays light.

### Chat controls

- **Stop** (square while it is working) cancels the current run. Writes that already finished in that run still flush.
- **Send** with an empty box retries the last request (same as the composer hint).
- **New chat** clears the thread. The card stays as last written.
- Delete a message to trim from that point; you cannot delete while a run is in progress.

If you Stop while it is still thinking, Send is available again so you can retry or type a new ask.

## Context meter

The Agent chat shows estimated tokens for catalogs, custom context, and the live prompt while a run is going. Lookup reads (full field or entry bodies) count in that live number, then drop out of the transcript so the thread does not keep those bodies.

Idle, the meter is catalogs + custom context + what is still in the chat. Raise **Settings → Sampler → Context Length** if large books run close to the limit.

The sampler **Max Tokens** slider does not cap Agent output the same way. Agent completions use a larger output budget so tool calls are less likely to cut off.

## Model for Agent

On **Settings → Prompts**, the **Agent** card at the top uses the same picker as toolbar ops:

- **Default (AI Config)** to keep the global model
- Or pick an endpoint you already configured and a model id

Keys stay on **AI Config**. Save Settings before the mapping applies. Character Agent and lorebook Agent share this one mapping.

The Agent is **not** Orion with extra buttons. It has to emit valid tool calls, often several in a row. A model that chats well can still fail here.

Point Agent at a **current tool-calling / agentic** model. Leave a cheap chat model on **AI Config** for Orion and Fix if you want; do not make the Agent use that same model.

See [AI Setup → Prompts Tab](/configuration/ai-setup#prompts-tab). If tool calls fail, see [Troubleshooting](#troubleshooting).

## Limits (per run)

If a job is huge, send a second ask for the rest.

| Cap | About |
| :--- | :--- |
| Field updates | 30 |
| Greeting add/update/delete | 20 |
| Lorebook add / update / delete | 50 each |
| Tool calls in one model reply | 12 |
| Loop turns | 32 |

Duplicate lorebook **names** in one run revise the new entry instead of adding a second copy. Names that already existed in the book are rejected; ask it to update that id.

## Snapshots

Before the Agent writes, CharacterVault stores one snapshot of the current card or book (if something actually changed). **Opened card** / **Opened** stays last in the list and cannot be deleted.

Open **Snapshots** (character) or **History** (vault book) to compare and restore. Linked characters follow a restored library book, same as a manual restore.

[Snapshots & Rollback](/features/snapshots-history)

## Tips

- Put source notes in **custom context**, then ask for a fill or a pass (thin description, rename keys, add missing entries).
- Prefer one clear job per Send. Split “rewrite description” and “rebuild the lorebook” if either is large.
- **Stop**, then empty **Send**, retries the last user message.
- After a run, skim Snapshots if the write was bigger than you meant.

## Troubleshooting {#troubleshooting}

Most “the Agent is broken” reports are the **model**. CharacterVault can only run the tools the model actually calls. If the model cannot do function calling, no setting will save the run.

### Tool calls fail, loop, or never write the card

::: tip
Switch to a newer model that is trained for tools. That is the fix.
:::

A small chat model, a roleplay finetune, or last year’s instruct weights will invent XML, call `tool_name`, skip tools and “helpfully” dump prose, or loop the same empty call. That is expected. Those models were not trained for this job.

Size is not enough. An old 70B chat model still loses to a current ~27B that was post-trained for agents. **Qwen3.8-27B** (released August 2026) is a dense open-weight example that handles this Agent well, including the **Thinking** listing on NanoGPT. Hosted names look like `qwen3.8-27b` / `qwen3.8-27b:thinking` (NanoGPT) or `qwen/qwen3.8-27b` (OpenRouter). Fetch the catalog; do not type a guessed slug.

Other current families that are actually built for multi-step tool use (as of August 2026):

| Family | Why it belongs here |
| :--- | :--- |
| **Qwen3.8** | **Qwen3.8-27B** for a compact pick; **Qwen3.8-Max** if you want the flagship |
| **DeepSeek V4** | **V4 Pro** (or Flash if you need cheaper / faster) |
| **GLM-5.3** | Current GLM coding/agent stack; **GLM-5.2** is the previous one |
| **Kimi K3** | Current Kimi flagship; older **K2.5 / K2.6** are a generation behind |
| **GPT-5.6 / Claude Opus 4.8** class | Fine via OpenRouter or another compatible gateway if you already pay for them |
| **Gemma 4** (local) | Native tool calling across the lineup, including the small **E2B** / **E4B** cuts. See [Local models](#local-models). |

Do **not** use for Agent:

- Small chat/instruct models with **no** tool-calling post-training (generic 7B–8B chat is not the same as **Gemma 4 E2B / E4B**)
- Roleplay, NSFW, or “uncensored chat” finetunes unless you have already seen them emit clean native `tool_calls` on a real Agent run
- Older lines: **Llama 3.x** chat, **Qwen2.5**, **Qwen3** 8B/14B as your daily Agent, **DeepSeek V3 / V3.1 / V3.2**, **GLM-4.x**, **Gemma 3**
- Cheap **mini / nano / flash** SKUs sold for one-shot chat, unless the provider lists tools **and** a real Agent pass works

Orion can stay on a weaker model. Map **Settings → Prompts → Agent** to one of the families above, save, and run again.

### Local models {#local-models}

Local works if you pick models that were trained for tools. Point **Settings → Prompts → Agent** at your local endpoint (LM Studio, llama.cpp, Ollama, and so on).

**Gemma 4** is the example. The whole lineup can call tools, including the small **E2B** and **E4B** cuts. E4B is already useful in practice (a pass that rekeys a dozen lorebook entries is in range). **12B**, **26B-A4B**, and **31B** hold up better as the job gets larger.

::: tip
More parameters plus tool-call training just works better. A 4B that knows tools will beat a 70B that does not. Between two tool-trained models, the bigger one is the safer pick for a full card or a whole-book rewrite.
:::

### The Agent talks instead of editing

It is chatting. A tool-capable model reads catalogs and calls `list` / `read` / `update` / `replace`. If you only get a paragraph in the chat and no colored tool lines, the model did not call tools. Same fix: newer tool-calling model.

### `incomplete_action` or cut-off tool JSON

The model started a call and ran out of output, or emitted broken JSON/XML. CharacterVault salvages truncated native calls when it can, then asks the model to finish. If that keeps happening:

- Use a model with **native** `tools` (not XML-in-chat)
- Prefer a current tool-calling model (**Qwen3.8**, **DeepSeek V4**, **GLM-5.3**, **Kimi K3**, or **Gemma 4**) over a chat-only instruct
- Split the job, or step up a size, if a small local keeps cutting off (“rewrite description” vs “rebuild the lorebook”)

Agent output is **not** capped by the Sampler **Max Tokens** slider; raising that slider will not fix a model that cannot close a call.

### Context meter is full / prompt too long

Raise **Settings → Sampler → Context Length**. Huge books plus custom context plus a long thread will crowd the window. Start **New chat** if the thread is old; the card stays as last written. Lookup bodies count in the live meter, then drop out.

### Changes never appear in the editor

The Agent writes **once**, when the run finishes (or you **Stop**, for tools that already completed). The **Agent writing** header label is the cue. If the run ends with no tool lines, nothing was applied. That is a model/tool failure, not a delayed save.

### Lorebook writes did not reach the vault book

The character must have a [linked library book](/features/lorebook-vault#attach-to-a-character-vault-local). Unlinked card books stay on the character only.

### Wrong greeting number

**Greeting 1** is the first *alternate*, same as the editor. First Message is a separate field. Ask for “greeting 1” or “first message” explicitly.

## Next Steps

- [AI Assistant Orion](/features/ai-assistant) (chat that does not write the card)
- [AI Context Panel](/features/ai-context)
- [Configure the Agent model](/configuration/ai-setup#prompts-tab)
- [Snapshots & Rollback](/features/snapshots-history)
- [Greetings Editor](/features/greetings-editor)
- [Lorebook Editor](/features/lorebook-editor)
- [Lorebook Vault](/features/lorebook-vault)

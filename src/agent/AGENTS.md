# Agent package

Browser-side tool loop. The rest of the app imports **only** `src/agent/index.ts`.

## Layout

| Path | Role |
|------|------|
| `index.ts` | Public API. Keep this list short. |
| `core/` | Host-agnostic runtime. No `CharacterBook`, Dexie, or React. |
| `core/parseActions.ts` | XML / fence lexer. Salvages a truncated last call when name + payload are already there. |
| `core/toolCalls.ts` | Native `tool_calls` JSON → `ParsedAction`, including truncated-JSON repair. |
| `core/runLoop.ts` | complete → native tools or XML parse → `host.execute` → feed results. |
| `hosts/lorebook/` | Lorebook host: entry CRUD, `search`, `replace_across`, `audit_book`, `read_recursion`, `test_keys`, `update_book_settings`. |
| `hosts/character/` | Card host: spec fields, greetings, `search`/`replace_across`/`audit_card` over the whole card, and (composed) embedded lorebook tools. |
| `ui/` | Shared session (`useAgentSession`) plus host wrappers (`useLorebookAgent`, `useCharacterAgent`) and chat mounts. |

## Public API

- `LorebookAgentChat` / `useLorebookAgent` — standalone vault lorebook workspace
- `CharacterAgentChat` / `useCharacterAgent` — character workspace (spec, greetings, embedded lorebook)
- `AgentToolEvent`

Do not export the parser, loop, or host from the barrel. Tests import those files directly.

## Adding a lorebook tool

1. Handle it in `hosts/lorebook/tools.ts`.
2. Add the name to `LOREBOOK_TOOL_NAMES`.
3. Add an OpenAI function schema in `hosts/lorebook/schemas.ts` and document the tool in `hosts/lorebook/prompt.ts`. Native `tools` / `tool_calls` are the primary control plane. XML `<tool_call>` is a separate mode (never in the same system prompt). A 400 that rejects `tools` is cached per base URL + model; the run rebuilds an XML-only prompt and retries. Later runs for that model start in XML. The parser still accepts `<<<>>>` fences; do not teach that format.
4. Tests under `tests/agent/hosts/lorebook/`.

Do not mention the tool in `core/`.

## Adding a character tool

1. Handle it in `hosts/character/tools.ts`.
2. Add the name to `CHARACTER_TOOL_NAMES`.
3. Add an OpenAI function schema in `hosts/character/schemas.ts` and document the tool in `hosts/character/prompt.ts`.
4. Tests under `tests/agent/hosts/character/`.

Do not mention the tool in `core/`. Lorebook entry tools are composed from `hosts/lorebook/` inside `createCharacterHost`; do not copy those implementations.

## Adding a host

New folder `hosts/<name>/` plus a new hook/wrapper under `ui/`. Export the wrapper from `index.ts` if the app needs to mount it.

Do not add `if (host === 'lorebook')` in `core/`.

## Wiring

`LorebookWorkspace` and `CharacterWorkspace` import from `../../agent`. `AIChatPanel` / `useAIChat` must not import this package. Shared chrome is `AIChatView` in `components/ai`. The review's line and word diff views live in `components/diff`, shared with the character snapshot history.

Edit on the last user message (`useEditLastMessage` in `components/ai/hooks`, shared with Orion's `AIChatPanel`) loads its text with the `setComposerText` that `AIChatView` hands to `renderMessage`. Nothing is trimmed until the edited text is sent through the composer (Continue never commits an edit). Like Send and Regenerate, it opens a pending review instead, so the review outcome still lands on its own run.

The agent chats pass `mentionOptions` (`ui/mentions.ts`) to `AIChatView`. Picking one inserts plain `@Label` text; the message format does not change. `MENTIONS_GUIDE` in `core/prompts.ts` tells the model what `@Name` means, so keep the labels in step with the field and entry catalogs.

On the character workspace, Agent mode always mounts `CharacterAgentChat` (tab changes do not remount the chat). Standalone lorebook workspace still mounts `LorebookAgentChat`. Orion stays the non-agent panel.

## Renderer / persist

- Build the system prompt once per run (custom context is cached; catalog updates ride tool results).
- `flush()` persists once at the end of the run (and on abort), not after every turn. Lorebook host writes the vault book. Character host persists spec and/or embedded book in one write (`persist({ spec, book })`) so a book write cannot clobber a spec write. Snapshot once before that write.
- Hosts hand over the whole proposed card or book. `useCharacterAgent` / `useLorebookAgent` apply only what the run changed on top of the latest saved card or book (the same merge as review Apply), so editor edits made during the run survive. Workspace `persist` / `setBook` take a builder that receives that latest value.
- While a run is in progress, the chat shows a spinner plus throttled live thinking and live speech (tool XML / fences stripped). Both are flushed on an interval so token-by-token setState does not blow memory. The spinner names the running tool's target from the `tool_start` headers (`ui/busyLabel.ts`). Entry names come from the saved book, so entries added earlier in the same run show as `#id`. Live thinking uses the same Thinking `<details>` fold as committed turns, open while streaming and collapsed after the turn commits. Collapsed folds drop the thinking body from the DOM. Committed turns also show TTFT / t/s / model on the info tip. Lookup turns (`list_entries` / `read_entry` / `search` / `audit_book` / `read_recursion` / `test_keys`, `list_fields` / `read_field` / `list_greetings` / `read_greeting` / `audit_card`) stay off the transcript (and are dropped from chat state so catalogs, bodies, and reasoning are not retained). Speech on a turn that also has tool calls is hidden (models often dump planning there). Tool results stored in the UI keep lookup headers only, not catalog or field/entry bodies.
- Earlier runs reach the model through `ui/loopHistory.ts`: one assistant message per run, plus `[App note: …]` lines naming its successful writes, the review outcome, and a turn-limit stop. The review outcome is a hidden `review_outcome` tool event on the run's last message. Tool bodies are never resent.
- A run that hits `DEFAULT_MAX_TURNS` gets the turn-limit notice on its last message, which is kept even when that turn was lookup-only (messages with a notice are never dropped). The latest message shows a Continue button that sends `CONTINUE_MESSAGE`.
- A run that ends on its own while the page is hidden or unfocused prefixes the tab title (`ui/finishNotice.ts`) until the page is visible and focused again. A window behind another app stays "visible", so focus has to count too. Stop and leave never mark it. Title only; no Notification API, so no permission prompt.
- Committed turns keep clipped reasoning (tail of the last 20k chars; reasoning is display-only and never resent). The in-stream reasoning buffer caps itself at the same tail past 2× the clip. Transcripts persist in IndexedDB per owner + panel. The React window is clipped at `CHAT_UI_MAX_WINDOW` (older rows stay on disk; “Load earlier messages” pages them back). New chat confirms, then clears that panel’s saved thread. Leave/unmount aborts the run and does not drop the saved transcript. A page refresh never unmounts, so the run's edits and any pending review would be lost; `ui/useLeaveWarning.ts` has the browser confirm a refresh or tab close while a run is going or a review is waiting. If the user leaves anyway, `ui/runMarker.ts` catches it: a localStorage marker per thread is written when a run starts, cleared when the run's flush is done, and held through a staged review (`holdRunForReview`) until `noteReviewOutcome`. A marker still present on hydrate adds a hidden `run_interrupted` event to the run's last message (a placeholder if the run left none). That run's write rows render struck through as "Not saved", and `loopHistory` sends an interrupted note instead of its edits.
- The context meter is catalogs + custom context + retained transcript while idle. During a run it tracks the live prompt, including tool-result bodies (`read_entry` and friends) and native `tool_calls`. That last prompt size stays on the meter until New chat, a truncated delete, or the next send. While a live prompt count is pinned, the chat skips the idle catalog/history estimate entirely.
- Same-name `add_entry` in one run revises the new entry (keeps the longer body). Names that already existed in the book are rejected; use `read_entry` then `update_entry` or `replace_in_entry` to change them.
- `replace_in_field` / `replace_in_greeting` / `replace_in_entry` / `replace_across` do a unique-match substring replace (or `replace_all`). Exact text wins; otherwise quotes, dashes, and newlines are folded. A multiline `old` can be the first line through the last unique line (middle may be mangled). Deleting a markdown heading alone is rejected so the section body is not left behind. They fail if `old` is missing or matches more than once. `replace_across` applies per place and fails the whole call if any one place is ambiguous. Full `update_*` still replaces the whole value. These writes do not go through CodeMirror.
- The host keeps an in-run copy of the book and caches formatted `read_entry` payloads by id. `update_entry` writes that cache so the next read returns the new body. `delete_entry` drops the id from the book and the read cache. `flush()` persists once at the end of the run.
- Agent `add_entry` sets `extensions.context_enabled: false` so new entries are not pinned into AI context.
- Agent completions send `max_tokens: 16384` without changing the sampler input budget. Native mode teaches function calls only and does not parse XML from the message body. XML mode is used when the provider has rejected `tools` (cached). Prefer `message.tool_calls` when the API returns them. One continuation on `finish_reason: length` if the XML tail is still unusable. Native turns echo `role: tool` results; XML turns keep the user-text result blob.

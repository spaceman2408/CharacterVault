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
| `hosts/lorebook/` | Lorebook host: entry CRUD, `search`, `replace_across`, `audit_book`, `read_recursion`, `update_book_settings`. |
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
3. Add an OpenAI function schema in `hosts/lorebook/schemas.ts` and document the tool in `hosts/lorebook/prompt.ts`. Native `tools` / `tool_calls` are the primary control plane. XML `<tool_call>` is the fallback (including when a provider 400s on `tools`). The parser still accepts `<<<>>>` fences; do not teach that format.
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

`LorebookWorkspace` and `CharacterWorkspace` import from `../../agent`. `AIChatPanel` / `useAIChat` must not import this package. Shared chrome is `AIChatView` in `components/ai`.

On the character workspace, Agent mode always mounts `CharacterAgentChat` (tab changes do not remount the chat). Standalone lorebook workspace still mounts `LorebookAgentChat`. Orion stays the non-agent panel.

## Renderer / persist

- Build the system prompt once per run (custom context is cached; catalog updates ride tool results).
- `flush()` persists once at the end of the run (and on abort), not after every turn. Lorebook host writes the vault book. Character host persists spec and/or embedded book in one write (`persist({ spec, book })`) so a book write cannot clobber a spec write. Snapshot once before that write.
- While a run is in progress, the chat shows a spinner plus throttled live thinking (reasoning only; speech/tool JSON stays out of the DOM). Live thinking is capped and flushed on an interval so token-by-token setState does not blow memory. It uses the same Thinking `<details>` fold as committed turns, open while streaming and collapsed after the turn commits. Collapsed folds drop the thinking body from the DOM. Committed turns also show TTFT / t/s / model on the info tip. Lookup turns (`list_entries` / `read_entry` / `search` / `audit_book` / `read_recursion`, `list_fields` / `read_field` / `list_greetings` / `read_greeting` / `audit_card`) stay off the transcript (and are dropped from chat state so catalogs, bodies, and reasoning are not retained). Speech on a turn that also has tool calls is hidden (models often dump planning there). Tool results stored in the UI keep lookup headers only, not catalog or field/entry bodies.
- Committed turns keep clipped reasoning (tail of the last 20k chars; reasoning is display-only and never resent). The in-stream reasoning buffer caps itself at the same tail past 2× the clip, and the transcript is trimmed oldest-first at 100 messages (`AGENT_MAX_CHAT_MESSAGES`), dropping tool events and errors for trimmed ids with it.
- The context meter is catalogs + custom context + retained transcript while idle. During a run it tracks the live prompt, including tool-result bodies (`read_entry` and friends) and native `tool_calls`. That last prompt size stays on the meter until New chat, a truncated delete, or the next send. While a live prompt count is pinned, the chat skips the idle catalog/history estimate entirely.
- Same-name `add_entry` in one run revises the new entry (keeps the longer body). Names that already existed in the book are rejected; use `read_entry` then `update_entry` or `replace_in_entry` to change them.
- `replace_in_field` / `replace_in_greeting` / `replace_in_entry` / `replace_across` do a unique-match substring replace (or `replace_all`). Exact text wins; otherwise quotes, dashes, and newlines are folded. A multiline `old` can be the first line through the last unique line (middle may be mangled). Deleting a markdown heading alone is rejected so the section body is not left behind. They fail if `old` is missing or matches more than once. `replace_across` applies per place and fails the whole call if any one place is ambiguous. Full `update_*` still replaces the whole value. These writes do not go through CodeMirror.
- The host keeps an in-run copy of the book and caches formatted `read_entry` payloads by id. `update_entry` writes that cache so the next read returns the new body. `delete_entry` drops the id from the book and the read cache. `flush()` persists once at the end of the run.
- Agent `add_entry` sets `extensions.context_enabled: false` so new entries are not pinned into AI context.
- Agent completions send `max_tokens: 16384` without changing the sampler input budget. Prefer `message.tool_calls` when the API returns them; otherwise parse XML and salvage a cut last call. One continuation on `finish_reason: length` if the tail is still unusable. Native turns echo `role: tool` results; XML turns keep the user-text result blob.

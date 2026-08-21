# Agent package

Browser-side tool loop. The rest of the app imports **only** `src/agent/index.ts`.

## Layout

| Path | Role |
|------|------|
| `index.ts` | Public API. Keep this list short. |
| `core/` | Host-agnostic runtime. No `CharacterBook`, Dexie, or React. |
| `core/parseActions.ts` | Fence lexer. Tool names are opaque strings. |
| `core/runLoop.ts` | complete → parse → `host.execute` → feed results. |
| `hosts/lorebook/` | First host: `list_entries`, `add_entry`. |
| `ui/` | React wire-in (`useLorebookAgent`, `LorebookAgentChat`). |

## Public API

- `LorebookAgentChat` — mount this from `LorebookWorkspace`
- `useLorebookAgent` — same session, if a caller needs the hook directly
- `AgentToolEvent`

Do not export the parser, loop, or host from the barrel. Tests import those files directly.

## Adding a lorebook tool

1. Handle it in `hosts/lorebook/tools.ts`.
2. Add the name to `LOREBOOK_TOOL_NAMES`.
3. Document the XML `<tool_call>` in `hosts/lorebook/prompt.ts`. The parser still accepts `<<<>>>` fences as a fallback; do not teach that format in prompts.
4. Tests under `tests/agent/hosts/lorebook/`.

Do not mention the tool in `core/`.

## Adding a host

New folder `hosts/<name>/` plus a new hook/wrapper under `ui/`. Export the wrapper from `index.ts` if the app needs to mount it.

Do not add `if (host === 'lorebook')` in `core/`.

## Wiring

`LorebookWorkspace` imports from `../../agent`. `AIChatPanel` / `useAIChat` must not import this package. Shared chrome is `AIChatView` in `components/ai`.

## Renderer / persist

- Build the system prompt once per run (custom context is cached; catalog updates ride tool results).
- `flush()` persists the book once at the end of the run (and on abort), not after every turn.
- The chat stream shows speech only — tool bodies never go into the live DOM.
- Agent `add_entry` sets `extensions.context_enabled: false` so new entries are not pinned into AI context.

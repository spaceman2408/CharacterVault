# Services — AI engine and related modules

Browser-only OpenAI-compatible client. Domain logic lives in these modules; transport is `fetch` plus SSE parsing in `AIService`.

Settings UI: `components/settings/` (see that folder’s `AGENTS.md`). Types and defaults: `db/characterTypes.ts`.

## Layout

| Path | Role |
|------|------|
| `AIService.ts` | Completions, streaming, abort, token budgets, operation wrappers, request preview. Orchestrates the pipeline; format-specific reasoning and gateway quirks live in sibling modules. |
| `PromptBuilder.ts` | Personas and system prompt assembly (`editor` vs `chat` / Orion). |
| `chatRequestRepair.ts` | On 400: strip or remap unsupported params; capability cache keyed by baseUrl + model. |
| `resolveOperationConfig.ts` | Toolbar operation → sampler / prompt resolution. |
| `ReasoningParser.ts` | Public re-export of `reasoning/`. Import from here or the services barrel. |
| `reasoning/` | Structured-field extractors, think-tag parsing, model-id format hints, stream orchestrator. |
| `providers/` | Base-URL adapters: model catalog, host-specific chat headers, NanoGPT extras. |
| `providers/types.ts` | `IProviderAdapter` contract. |
| `providers/OpenAICompatProvider.ts` | Generic OpenAI-compatible fallback (last in the resolve list). |
| `providers/NanoGPTProvider.ts` | NanoGPT models, provider selection, subscription and balance. |
| `providers/SyntheticProvider.ts` | Synthetic models (syn: aliases first), embedding filter, subscription quotas. |
| `providers/OpenRouterProvider.ts` | OpenRouter catalog (text models, display names), reasoning efforts, attribution headers, GET /key usage. |
| `providers/NanoGPTAuth.ts` | NanoGPT OAuth helpers. |
| `index.ts` | Public barrel for services. |

Call sites: `hooks/useAIEditor.ts` (toolbar), `components/ai/hooks/useAIChat.ts` (Orion), editor toolbar and payload preview.

The lorebook tool-loop agent lives in `src/agent/` (not this folder). `AIService.chat()` is transport only.

## Request pipeline

1. Build messages (`PromptBuilder`, `buildOperationMessages`, or chat history + context).
2. Enforce input token budget (`estimateTokens`, `fitContextChunks`, `enforceInputBudget`).
3. Build body (`buildChatCompletionBody`: sampler, reasoning flags, capability-cache sanitize).
4. `sendRequest`. On 400, `repairChatRequest` / strip non-standard params and retry (few attempts).
5. Stream: SSE `data:` lines → `ReasoningParser.parseChunk` → `onChunk({ content?, reasoning? })`.
6. Non-stream: `extractMessageReasoning` on the final assistant message.

Streaming and UI use separate content and reasoning deltas.

## Reasoning (`reasoning/`)

Every chunk: structured JSON fields first, then think tags in content. Model-id format is a soft hint only; field extractors always run.

| File | Role |
|------|------|
| `reasoning/fieldExtractors.ts` | Registry of structured locations (`reasoning_content`, `reasoning`, choice-level reasoning, `reasoning_details`, …). First non-empty wins. |
| `reasoning/thinkTags.ts` | Tag pairs (`<think>`, channel markers, …) and stream buffer for tags split across chunks. |
| `reasoning/formatHints.ts` | Model-id rules → separate-field vs inline-tag hint. |
| `reasoning/types.ts` | `ReasoningSource`, chunk/message shapes, parse results. |
| `reasoning/ReasoningParser.ts` | Stream state and orchestration. Vendor-specific field logic belongs in extractors or tag pairs, not here. |

### Structured reasoning (API JSON fields)

1. Field shape on `ReasoningSource` (and chunk/message types if needed) in `reasoning/types.ts`.
2. One entry in `STRUCTURED_FIELD_EXTRACTORS` in `fieldExtractors.ts`.
3. `sourceFromChunk` / `sourceFromMessage` map wire locations into `ReasoningSource`.
4. Fixture coverage in `tests/services/ReasoningParser.test.ts`.
5. Non-stream responses use the same extractors via `extractMessageReasoning` in `AIService`.

### Think / channel tags in content

1. `{ start, end }` pair in `THINK_TAG_PAIRS` (`thinkTags.ts`).
2. Tests for a full string and for tags split across stream chunks.

### Model-id format hints

1. Rule in `FORMAT_HINT_RULES` (`formatHints.ts`). First match wins; put specific patterns before broad ones.
2. When the gateway sends structured fields, the extractor registry is the source of truth; the hint only affects empty structured deltas.

## Providers

`resolveProvider(baseUrl)` uses the first adapter whose `matches()` is true. OpenAI-compat is the last fallback.

| Concern | Location |
|---------|----------|
| Host-specific chat headers | `getChatHeaders` on the adapter |
| `/models` or catalog shape | `fetchModels` on the adapter |
| Provider selection / billing (NanoGPT) | Dedicated adapter + `maySupportProviderSelection` |
| Synthetic catalog / quotas | Dedicated adapter + `fetchQuotas` |
| OpenRouter catalog / key usage | Dedicated adapter + `fetchKey` |
| Generic OpenAI-compatible hosts | Fallback adapter |

URL detection, catalog quirks, and NanoGPT subscription/balance stay in `providers/`, not in `AIService`.

## Chat request repair

Unsupported sampler or reasoning parameters are handled in `chatRequestRepair.ts` (pure helpers), driven from the completion retry loop in `AIService`.

- `NON_STANDARD_PARAMS` and related strip lists define removable fields.
- Capability cache stores rejected params and effort allowlists per model.
- Strict hosts (e.g. api.openai.com) omit non-standard samplers up front via `sanitizeSamplerParams`.

Remaps, strip lists, and host snippets live here with tests in `tests/services/chatRequestRepair.test.ts`.

## Prompts and operations

- Personas and stable system prefix: `PromptBuilder.ts`.
- Per-operation user templates: prompt settings from the DB (`prompts.expand`, etc.), interpolated in `AIService`.
- Toolbar operations: types and defaults in `characterTypes`, `resolveOperationConfig`, `AIService` method, editor hook/UI. Character-card field shapes stay SillyTavern-compatible unless the change is explicitly about those fields.

## Conventions

- Local-first: user API keys and base URLs in the browser; core AI does not require a backend.
- Wire format is OpenAI-compatible (`/chat/completions`, SSE `data:` lines). Gateway differences go through repair, reasoning extractors, or provider adapters.
- Settings persistence is draft-then-save via `CharacterSettingsService` and settings hooks; services do not write settings from tab UI.
- Token estimates use a UTF-8 byte heuristic (`BYTES_PER_TOKEN`) for budgeting, not billing. Estimates share one module-level `TextEncoder`; do not allocate a new encoder per call.
- Edge cases prefer pure helpers plus tests under `tests/services/`.
- Intentional public surface is exported from `services/index.ts`.

## Tests

| Area | File |
|------|------|
| Reasoning extractors, tags, stream | `tests/services/ReasoningParser.test.ts` |
| 400 repair / capability cache | `tests/services/chatRequestRepair.test.ts` |
| Stream abort / cleanup | `tests/services/AIService.streamCleanup.test.ts` |
| Request preview body | `tests/services/AIService.previewOperationRequest.test.ts` |
| Prompts | `tests/services/PromptBuilder.test.ts` |
| Token budget helpers | `tests/services/estimateTokens.test.ts`, `fitContextChunks.test.ts`, … |

After non-trivial AI changes: `npm run lint`, `npm run build`, and the relevant tests above.

# CharacterVault — Agent Guide

## What this is

**CharacterVault** is a browser-only app for creating, editing, and organizing AI roleplay character cards (SillyTavern V2/V3 compatible). Data stays local in IndexedDB. No backend account is required for core use.

Main capabilities:

- Character library (search, sort, import/export PNG/JSON)
- Full card editor (description, personality, scenario, greetings, lorebook, creator notes, etc.)
- AI assistant (Orion), inline AI toolbar, and AI Creation Studio
- Snapshots / history rollback
- Settings for AI providers (OpenAI-compatible + NanoGPT), prompts, sampler, sections, studio

Live site: Cloudflare Pages (`charactervault.app` landing, `vault.charactervault.app` app). License: GPL-3.0-only.

## Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript (strict) |
| UI | React 19 + React Router |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| DB | Dexie (IndexedDB) |
| Editor | CodeMirror 6 |
| Tests | Vitest |
| Docs | VitePress (`docs/`) |
| Lint | ESLint (`eslint.config.js`) |

## Layout (high level)

```
src/
  App.tsx                 # Vault library + routing shell
  agent/                  # Browser tool-loop package (lorebook host first). Public API: index.ts
  components/             # UI: workspace, editor, AI chat, settings, history
  context/                # React context + hooks for character / editor state
  db/                     # Dexie schema, character types, defaults
  editor/                 # CodeMirror extensions + spellcheck
  hooks/                  # Shared hooks (AI editor, character, clipboard import)
  pages/                  # Import page, AI Creation Studio
  services/               # Import/export, AI, prompts, snapshots, settings, providers
  utils/
tests/                    # Vitest unit tests (mirror service/editor areas)
docs/                     # User-facing VitePress docs
public/                   # Static assets, dictionary files
workers/                  # Optional NanoGPT usage proxy (self-hosted production only)
```

Feature-specific agent notes may live next to a module (e.g. `src/components/settings/AGENTS.md`). Prefer those over inventing new patterns for that area.

## Coding policies

### Verification (required after non-trivial changes)

Run from repo root:

```bash
npm run lint
npm run build
```

- `npm run lint` → `eslint .`
- `npm run build` → `tsc -b && vite build` (typecheck + production build)

If you touch logic covered by tests, also run:

```bash
npm test
```

Do not treat a change as done if lint or build fails. Fix the errors you introduced.

### Comments

- **Do not comment** unless it is necessary to explain non-obvious behavior, a deliberate constraint, or something that would be easy to “fix” incorrectly.
- Prefer clear names and structure over narrative comments.
- No file headers, section banners, or restating the next line of code.

### TypeScript / React

- Prefer existing types in `src/db/characterTypes.ts` and nearby module types; extend them instead of inventing parallel shapes.
- Keep UI components focused; put business logic in `services/`, hooks, or context — match the surrounding module.
- Follow patterns already used in the folder you edit (exports via `index.ts`, draft-then-save settings, provider abstractions under `services/providers/`).
- Do not add dependencies unless required; if you must, prefer small, well-maintained packages consistent with the stack above.

### Scope

- Change only what the task needs. Avoid drive-by refactors, renames, and unrelated cleanup.
- Do not expand scope into docs, deploy scripts, or release notes unless asked.
- Preserve SillyTavern / character-card compatibility when touching import, export, or card fields.

### Style

- Match local formatting, naming, and Tailwind usage.
- No drive-by comment removal for its own sake in untouched code; new code should simply omit unnecessary comments.

## Common commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local app (Vite) |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck + app build |
| `npm test` | Vitest once |
| `npm run test:watch` | Vitest watch |

## AI / providers (orientation)

- Provider implementations: `src/services/providers/`
- Prompt assembly: `src/services/PromptBuilder.ts`
- Chat UI: `src/components/ai/`
- Settings UI and persistence path: see `src/components/settings/AGENTS.md`

Settings draft is not written to IndexedDB until save; do not persist from tab components directly.

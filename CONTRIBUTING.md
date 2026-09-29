# Contributing to CharacterVault

Thanks for helping out. Bug reports, ideas, docs fixes, and code are all welcome.

## Ways to help

- **Report a bug**: open an [issue](https://github.com/spaceman2408/CharacterVault/issues) with what you did, what you expected, and what happened. Include your browser, and a card or lorebook that shows the problem if you can share one.
- **Suggest a feature**: open an issue or post in the [Discord](https://discord.gg/T9jbbArPrF). Say what you're trying to do, not only the button you want.
- **Fix the docs**: the docs are Markdown files in `docs/`. Small fixes can go straight to a pull request.
- **Send code**: for anything bigger than a small fix, open an issue first so we can agree on the approach before you spend time on it.

**Security issues:** please don't post them in public issues. [Report them privately](https://github.com/spaceman2408/CharacterVault/security/advisories/new) instead. If that doesn't work for you, message spaceman2408 on [Discord](https://discord.gg/T9jbbArPrF). See [SECURITY.md](SECURITY.md) for what's in scope.

## Setup

You need Node 22 (see `.nvmrc`).

```bash
git clone https://github.com/spaceman2408/CharacterVault
cd CharacterVault
npm install
npm run dev
```

The app runs at `http://localhost:3000`. To work on the docs, run `npm run docs:dev` and open `http://localhost:3001`.

You don't need an AI key for most work. To test AI features, add any OpenAI-compatible endpoint in **Settings → AI Config**. A local server like LM Studio works.

## Before you open a pull request

All three must pass:

```bash
npm run lint
npm run build
npm test
```

`npm run build` also runs the TypeScript typecheck. If you change a service, parser, or import/export code, add or update a test in `tests/`.

## Pull requests

- Branch from `staging` and open your PR against `staging`. `main` only gets releases.
- Keep each PR to one change. Leave out unrelated refactors, renames, and formatting.
- Say what changed and how you tested it. Add a screenshot for UI changes.
- Update the page in `docs/` if you change how a feature works.

## Code guidelines

The stack is React 19, TypeScript (strict), Vite, Tailwind CSS 4, Dexie (IndexedDB), and CodeMirror 6.

- **Match the code around you.** Follow the naming, structure, and Tailwind usage in the folder you're working in. Some folders have their own `AGENTS.md` with local rules.
- **Business logic goes in `services/`, hooks, or context.** Components should stay focused on UI.
- **Reuse existing types** from `src/db/characterTypes.ts` instead of adding parallel ones.
- **Keep cards compatible.** Import and export must keep working with SillyTavern V2/V3 cards. Don't rename or drop card fields.
- **Keep it local-first.** User data stays in the browser. Don't add a backend, accounts, analytics, or calls to third-party services.
- **Only add a dependency when you have to**, and say why in the PR.
- **Comment only what isn't obvious**, like a workaround or a deliberate constraint.

Using an AI coding assistant is fine. [AGENTS.md](AGENTS.md) has the project rules in a form they can read. You're still responsible for reviewing and testing what it writes.

## License

CharacterVault is licensed under the [GNU GPL v3.0](LICENSE). By contributing, you agree that your contributions are released under the same license.

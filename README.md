<p align="center">
  <img src="public/CharacterVaultLogo.svg" alt="Character Vault Logo" width="400" height="200">
</p>

<p align="center">
  <strong>Create, edit, and organize roleplay character cards and lorebooks in your browser</strong>
</p>

<p align="center">
  SillyTavern compatible • No server required • No account needed
</p>

<p align="center">
  <a href="https://charactervault.app">Website</a> •
  <a href="https://vault.charactervault.app/">Try Online</a> •
  <a href="https://vault.charactervault.app/docs/">Documentation</a> •
  <a href="https://github.com/spaceman2408/CharacterVault">GitHub</a>
</p>

---

## Features

- **Character Library** - Grid view of all your characters with search and quick actions
- **Lorebook Vault** - Standalone World Info library: create, search, import, export, duplicate, and link one book across characters
- **Full Card Editor** - Edit every V2/V3 field: name, description, personality, scenario, greetings, lorebook, creator notes, and more
- **AI Assistant Orion** - Built-in chat to help brainstorm and write character and lorebook content
- **AI Agent** - Chat that writes the open character card or lorebook (optional review diff before writes land)
- **AI Creation Studio** - Generate a full card from a concept or tags, with custom prompts and field toggles
- **AI Toolbar** - Enhance, rephrase, shorten, lengthen, or fix selected text inline
- **Lorebook Editor** - Shared editor for card books and vault books: ST fields, content-first layout, AI-generated keys
- **Recursion Map** - Fullscreen web of unlock paths; inspect entries, edit keys in place, and bulk-edit flags
- **Creator Notes** - HTML/CSS support with live preview
- **Import & Export** - PNG cards with embedded data or JSON files, plus standalone lorebook JSON, compatible with SillyTavern and any frontend that accepts the same formats
- **Snapshots & Rollback** - Save manual snapshots and restore a full card, individual sections, or a standalone lorebook
- **Offline Storage** - All data stays in your browser via IndexedDB

---

## Quick Start

### Use Online

Visit **[https://vault.charactervault.app](https://vault.charactervault.app)** (marketing site: [charactervault.app](https://charactervault.app))

### Run Locally

```bash
git clone https://github.com/spaceman2408/CharacterVault
cd CharacterVault
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

---

## Documentation

Full documentation is available at **[https://vault.charactervault.app/docs/](https://vault.charactervault.app/docs/)**

Topics include:

- Installation and setup
- Creating and editing characters
- Lorebook vault, linking, and the recursion map
- AI configuration (Orion, Agent, toolbar, prompts)
- Import and export options
- Snapshot and rollback guide

---

## Troubleshooting

**AI toolbar buttons are disabled?** Configure an AI provider in Settings → AI Config.

**Selection too long?** Reduce your text selection or increase Context Length in Settings → Sampler.

**Need help?** Open an issue on [GitHub](https://github.com/spaceman2408/CharacterVault/issues).

---

## Privacy

Character cards and lorebooks stay in your browser. See the [Privacy](https://vault.charactervault.app/docs/privacy) notice for hosting and optional AI details.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE)

---

<p align="center">Vibecoded with ❤️ by spaceman2408 for the AI roleplay community</p>
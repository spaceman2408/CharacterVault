# Installation

Character Vault runs entirely in your browser. You can use the hosted version or run it locally.

## Option 1: Use Online (Recommended)

Visit **[https://vault.charactervault.app](https://vault.charactervault.app)** and start using Character Vault immediately. No installation required. The marketing site is **[https://charactervault.app](https://charactervault.app)**.

## Option 2: Run Locally

Running locally lets you develop on the codebase or use the app without an internet connection (AI features still require an API endpoint).

### Prerequisites

- **Node.js** — LTS version from [nodejs.org](https://nodejs.org/)
- **npm** — Comes with Node.js

### Steps

1. **Clone the repository**:

   ```bash
   git clone https://github.com/spaceman2408/CharacterVault
   cd CharacterVault
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

4. **Open in browser** — The terminal will display a local address (typically `http://localhost:3000`).

### Build for Production

```bash
npm run build
```

The production build outputs to the `dist/` directory.

If you **self-host** that production build (not just open the official site, and not only `npm run dev`), and you want NanoGPT **subscription** details in Settings, see [NanoGPT Usage Proxy (Self-Hosted Production)](/configuration/nanogpt-usage-proxy). **You do not need that for localhost.** Balance and AI still work without it.

## SillyTavern Integration

Export characters directly from SillyTavern to Character Vault using the **[SillyTavern CharacterVault Export Extension](https://github.com/spaceman2408/SillyTavern-CharacterVaultExport)**. This companion SillyTavern extension (not a browser extension) adds an "Export to CharacterVault" option in the main export menu. It copies the character to your clipboard for CharacterVault's import page.

### Clipboard Import

The extension uses the clipboard import page. You can also paste any card JSON there yourself:

1. Copy the character data (from the extension, or any card JSON).
2. Open the import page at `https://vault.charactervault.app/#/import`.
3. Click **Paste from Clipboard**, or paste into the paste box.

## What's Next?

- [Create your first character](/getting-started/creating-characters)
- [Configure the AI assistant](/configuration/ai-setup)
- [AI Agent](/features/ai-agent)

# Installation

Character Vault runs entirely in your browser. You can use the hosted version or run it locally.

## Option 1: Use Online (Recommended)

Visit **[https://spaceman2408.github.io/CharacterVault](https://spaceman2408.github.io/CharacterVault)** and start using Character Vault immediately. No installation required.

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

## SillyTavern Integration

Export characters directly from SillyTavern to Character Vault using the **[SillyTavern CharacterVault Export Extension](https://github.com/spaceman2408/SillyTavern-CharacterVaultExport)**. This companion browser extension adds an "Export to CharacterVault" option in the main export menu.

### Clipboard Import

Character Vault also supports clipboard-based import from SillyTavern:

1. In SillyTavern, copy a character to the clipboard.
2. Open Character Vault and navigate to the **Import** page (or use the `/import` route directly).
3. Paste the character data to import it.

## What's Next?

- [Create your first character](/getting-started/creating-characters)
- [Configure the AI assistant](/configuration/ai-setup)

# 🗃️ Character Vault

<p align="center">
  <img src="public/CharacterVaultLogo.svg" alt="Character Vault Logo" width="160" height="160">
</p>

<p align="center">
  <strong>A simple AI Character Management Suite</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/CodeMirror-6.0-C22B2B?style=for-the-badge&logo=codemirror&logoColor=white" alt="CodeMirror">
  <img src="https://img.shields.io/badge/Vite-7.2.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Tailwind-4.1.18-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Dexie-4.3.0-007ACC?style=for-the-badge&logo=database&logoColor=white" alt="Dexie">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#guide-creating--editing">Guide</a> •
  <a href="#editor--ai-toolkit">Editor</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

## Features

- **Character Library** — All your characters in one beautiful grid view with quick search and sorting.
- **Card Editor** — Edit every essential part of your character: name, description, personality, scenario, greetings, and more.
- **Lorebook/World Info Support** — Add lore entries with keywords that trigger during conversations.
- **AI Assistant Zoggy** — Built-in AI chat to help you write and brainstorm character details.
- **Context Panel** — Choose which character sections to include when chatting with the AI.
- **AI Tools** — Use AI to enhance and rephrase your text, apply stylistic filters, and more.
- **Image Support** — Upload and manage character avatar images or change existing ones.
- **Import & Export** — Bring in existing character cards (PNG or JSON) and export your creations.
- **Offline Support** — All your data is stored locally in your browser via IndexedDB.
  - Online ai tools require an internet connection.

---

## Installation

### Option 1: Use Online (Recommended)

Visit the hosted version and start using **Character Vault** immediately in your browser. (Will set up in github pages soon)

### Option 2: Run Locally

1.  **Install Node.js**: Get the LTS version from [nodejs.org](https://nodejs.org/).
2.  **Clone or Download**: `git clone https://github.com/spaceman2408/CharacterVault`
3.  **Install Dependencies**: `npm install`
4.  **Start the Engine**: `npm run dev`
5.  **Open in Browser**: The terminal will show a local address (like `http://localhost:3000`).

---

## Guide: Creating & Editing

### Creating a New Character

1. Click the **New** button in the top right.
2. Give your character a name.
3. Click **Create**.

### Editing Your Character

Manage every aspect of your character through a tabbed interface:

| Section           | What It's For                                           |
| :---------------- | :------------------------------------------------------ |
| **Image**         | Upload a character portrait                             |
| **Name**          | Your character's name                                   |
| **Description**   | How the character looks, acts, and behaves              |
| **First Message** | The opening greeting users see                          |
| **Greetings**     | Alternate opening messages                              |
| **Examples**      | Sample conversations showing how they talk              |
| **Scenario**      | The setting or situation for roleplay                   |
| **Appearance**    | Physical description details                            |
| **Personality**   | Personality traits and quirks                           |
| **System**        | Instructions for the AI about how to play the character |
| **Lorebook**      | Extra information that triggers on keywords             |
| **Creator**       | Your name (optional)                                    |
| **Creator Notes** | Notes for other users (supports styling)                |
| **Tags**          | Keywords to categorize your character                   |

---

## Editor & AI Toolkit

**Character Vault** uses a customized editor for all character text fields, providing a high-performance editing experience with specialized AI integrations.

### AI Toolbar

When you select text in any editor, a specialized AI toolbar appears automatically. This extension allows you to:

- **Enhance & Rephrase**: Quickly improve your writing or change the tone.
- **Custom Instructions**: Send specific prompts to the AI about the selected text.
- **Vivid & Emotional Polish**: Apply stylistic filters like "Vivid" for descriptions or "Emotion" for personality traits.

> Note: The prompts for these ai tools are customizable in the settings panel.

### Integrated Search

We've replaced the standard browser search with a custom-built, theme-aware Search & Replace tool:

- **Hotkeys**: Press `Ctrl+F` (or `Cmd+F`) to toggle the search bar. `Escape` to close. Or click the magnifying glass icon.

### Using the AI Assistant

The AI panel on the right is your creative partner:

1. Open the **AI Context** panel on the left to choose which parts of your character the AI can see.
2. Ask questions or request help in the **Ask AI** panel on the right.
3. The AI will use your selected character sections as context.

> I named the AI Assistant "Zoggy" after a craft lager brand.

---

## Vault Organization

- **Search**: Find characters instantly by name.
- **Duplicate**: Hover over a character and click the copy icon to make a backup.
- **Delete**: Remove characters you no longer need.
- **Quick Resume**: The "Continue" button jumps back to your most recent edit.
- **Auto-save**: Your data is saved automatically as you type.
- **Backup**: Export regularly as PNG files to stay safe.

---

## AI Configuration

Configure your brain via the settings panel:

- **AI Provider**: Nano-gpt, OpenRouter, and OpenAI-compatible endpoints.
- **Streaming**: Watch the AI think and type in real-time.
- **Temperature**: Adjust creativity vs. predictability.
- **Context Length**: Manage the total amount of text the AI can "remember" at once.

---

## Troubleshooting Context Warnings

AI models have a limit on how much text they can process at once.

| Warning                            | Root Cause                                      | Solution                                                |
| :--------------------------------- | :---------------------------------------------- | :------------------------------------------------------ |
| **"Selection is too long"**        | More text than context window allows.           | Select less text or increase **Context Length**.        |
| **"Please adjust Max Tokens..."**  | **Max Tokens** too close to **Context Length**. | Increase **Context Length** in settings.                |
| **"AI needs a larger context..."** | System instructions taking up whole window.     | Increase **Context Length** or decrease **Max Tokens**. |

### How Truncation Works

1.  **In Chat**: We prioritize persona and the current question. Old messages are "forgotten" first.
2.  **In Editor**: We prioritize the text you have selected. Context entries are dropped first if space is tight.

---

<p align="center">If you run into issues or have suggestions, feel free to open an issue on the repository.</p>

<p align="center">Vibecoded with ❤️ by spaceman2408 for the AI roleplay community.</p>

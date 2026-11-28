# What's New

Quick overview of recent updates to CharacterVault.

---

## November 2026

### 1.11.0

CharacterVault 1.11.0 reworks the AI Creation Studio with shorter prompts, a note on Regenerate, and a default perspective and tense, lets the Agent pick place names and share skills as files, and adds favorite characters and a check for common mistakes before export, plus a minimum quantization filter for OpenRouter.

- **Creation Studio rework**: shorter default prompts, a note button next to **Regenerate**, **Description changed** on outdated fields, and a starred default perspective and tense
- **Agent place names and skill files**: both Agents call `suggest_places` for new places, and **Settings → Agent Skills → Import / Export all** moves skills as files
- **Favorites and export check**: the star on a library card pins it to the top, and exporting lists likely mistakes first (**Settings → Character Workspace → Export**)
- **OpenRouter minimum quantization**: **Settings → AI Config → Provider** skips hosts below a chosen precision

[Release 1.11.0 →](/releases/v1.11.0) · [AI Creation Studio →](/features/ai-creation-studio) · [Import & Export →](/features/import-export#check-before-export)

### 1.10.0

CharacterVault 1.10.0 adds Find & Replace across a whole character or lorebook, with a grouped preview, a snapshot before every replace, and Undo. The AI Creation Studio shows each field's thinking while it writes and works with endpoints that need no API key, plus fixes for editing, Stop, and Regenerate during generation and for V3 card fields lost on import.

- **Find & Replace across a character**: **Character header → Find** or **Ctrl+Shift+F** searches every field, greeting, and lorebook entry, previews each change, and offers **Undo**
- **Find & Replace in lorebooks**: **Lorebooks → open a book → Find** searches the book name, description, and every entry
- **Creation Studio thinking and keyless endpoints**: each Studio field shows its **Thinking** while it generates, and endpoints with no API key work in the Studio and **Settings → Prompts**

[Release 1.10.0 →](/releases/v1.10.0) · [Find & Replace →](/features/editor#find-replace) · [Lorebook Vault →](/features/lorebook-vault#find-replace)

### 1.9.2

CharacterVault 1.9.2 makes the Creator Notes preview render the way SillyTavern does, with preview controls, a resizable Dock, and CSS tools. The editor keeps your cursor, scroll, and undo when you switch sections, wraps a selection when you type `*` or `"`, and fits phones with the keyboard open. Plus OpenAI and Google Gemini presets, a simpler Sampler, native-only Agent tool calls, and a fix for absurd tokens-per-second readings.

- **Creator Notes that render like SillyTavern**: **Creator Notes → Preview** has **Match SillyTavern** on by default, with Width, Background, Replay, and Remote media controls, a resizable **Dock**, **Insert** snippets, color swatches, and **Format**
- **The editor keeps your place**: switching sections keeps cursor, scroll, and undo; typing `*` or `"` over a selection wraps it; **Ctrl+D** selects the next match
- **Phone editing that fits**: no iPhone focus zoom, toolbars that fit, and more lines visible while the keyboard is open

[Release 1.9.2 →](/releases/v1.9.2) · [Creator Notes →](/features/creator-notes#match-sillytavern) · [Editor Controls →](/features/editor-controls)

### 1.9.1

CharacterVault 1.9.1 gives the Agent skills: named instructions it loads when your request matches, with three that ship and your own in a new Agent Skills settings tab. Claude runs in the Agent now hit the provider's prompt cache and the reply tooltip shows the measured hit rate. Settings save automatically, saved presets show up in the Prompts tab model pickers, and the Agent chat shows what the Agent read, searched, and checked and highlights @mentions, plus a fix for settings changes not reaching the lorebook Agent until a reload.

- **Claude runs hit the prompt cache**: Claude models on OpenRouter are marked cacheable on every Agent request, a run keeps one cut of older turns instead of moving it every turn, and the info button on a reply shows **Cached: N% of M input tokens**
- **Agent skills**: the Agent loads a skill when your request matches and shows **Used skill** on its reply; three ship, and **Settings → Agent Skills** adds your own and lists the tools a skill can name
- **Autosaved settings**: no more **Save Settings** button; changes save on their own and **Close** saves anything still waiting
- **Saved presets in model routing**: pick a saved preset in any endpoint list on **Settings → Prompts** to set its endpoint and model
- **What the Agent looked at**: each Agent reply lists what it read, searched, or checked; click a read to open it
- **@mention highlights**: matching @mentions are tinted in the Agent chat box

[Release 1.9.1 →](/releases/v1.9.1) · [Prompt caching →](/features/ai-agent#prompt-caching) · [AI Agent →](/features/ai-agent#skills)

### 1.9.0

CharacterVault 1.9.0 lets you save an endpoint and model as a named preset and switch between them from the AI Config dropdown, adds Moonshot (Kimi), Z.ai (GLM), Z.ai Coding Plan, and DeepSeek presets, and makes the library quicker to search and sort with clickable tag chips, search shortcuts, and a Created sort, plus bigger Agent batches, Agent recursion flag edits that stick and explain themselves, and fixes for thinking and reasoning models.

- **Saved presets**: **Settings → AI Config → Save as preset** keeps an endpoint and model under a name in the **Saved** group of the **API Base URL** dropdown, and presets on one endpoint share its key
- **New provider presets**: Moonshot (Kimi), Z.ai (GLM), Z.ai Coding Plan, and DeepSeek in **Settings → AI Config → API Base URL**
- **Library search and sort**: click a tag chip on a library card to search by it, press **/** to jump to the search and **Escape** to clear it, and sort by **Created**
- **Agent recursion flags**: flags the Agent turns off stay off, **Review agent edits** lists each changed entry setting, and the recursion map and key test explain blocked links and entries that can never activate

[Release 1.9.0 →](/releases/v1.9.0) · [AI Setup →](/configuration/ai-setup#saved-presets) · [AI Agent →](/features/ai-agent#what-it-can-check)

---

Older releases are on [GitHub](https://github.com/spaceman2408/CharacterVault/releases) and in the [Full Changelog](/changelog).

## See Also

- [Full Changelog](/changelog)
- [Getting Started](/getting-started/installation)

# What's New

Quick overview of recent updates to CharacterVault.

---

## November 2026

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

## October 2026

### 1.8.5

CharacterVault 1.8.5 warns before you leave a running Agent and marks runs that leaving cut short, adds an option for the Agent to remember exactly what it wrote earlier in the chat, and has it pick real names that fit the setting, plus em dash matching that leaves hyphens alone and a large round of Agent and chat fixes.

- **Leave warning for Agent runs**: refreshing or closing the tab during an Agent run or with a review waiting asks first; leave anyway and that run's edits are lost, with its writes shown as **Not saved**
- **Remember earlier edits**: **Settings → Character Workspace → Agent edits → Remember earlier edits in the chat**, off by default, shows the Agent exactly what it wrote in earlier runs
- **Real names**: asked for a rename or new NPCs without names, the Agent picks real names that fit the setting and never reuses one already on the card or in its lorebook

[Release 1.8.5 →](/releases/v1.8.5) · [AI Agent →](/features/ai-agent#leaving-mid-run)

### 1.8.4

CharacterVault 1.8.4 lets you pin and rank OpenRouter hosts, keep prompts private or stick to free models with new OpenRouter Options, keep Exacto on for Agent tool calls, and merge a library lorebook into a character's own entries, plus a fix for typing spaces in book names.

- **OpenRouter host control**: pin a host per model under **Provider**, set **Settings → AI Config → OpenRouter Options → Host priority**, and see which host answered in a reply's stats
- **OpenRouter privacy and model filters**: **No training on prompts**, **Zero data retention only**, and **Free models only** in **OpenRouter Options**, all off by default
- **Exacto for the Agent**: **OpenRouter Options → Always use Exacto for the Agent** keeps `:exacto` on Agent tool calls with any host priority
- **Merge a library book** (**Character → Lorebook → Attach**): **Merge** adds the book's entries after the character's own and unlinks the book

[Release 1.8.4 →](/releases/v1.8.4) · [AI Setup →](/configuration/ai-setup#openrouter-options) · [Lorebook Vault →](/features/lorebook-vault#merge-into-existing-entries)

---

Older releases are on [GitHub](https://github.com/spaceman2408/CharacterVault/releases) and in the [Full Changelog](/changelog).

## See Also

- [Full Changelog](/changelog)
- [Getting Started](/getting-started/installation)

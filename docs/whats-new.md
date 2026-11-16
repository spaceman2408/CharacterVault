# What's New

Quick overview of recent updates to CharacterVault.

---

## November 2026

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

### 1.8.3

CharacterVault 1.8.3 adds clickable variable chips to every prompt template, keeps linked lorebooks in sync both ways, and makes Settings ask before throwing away unsaved changes, plus Paste from Clipboard on import and a round of Settings and lorebook fixes.

- **Prompt variable chips** in **Settings → Prompts** and **Settings → Creation Studio → Generation Prompts**: click a chip to insert its variable at the cursor or find it if already used, with a hover explanation and red for a missing required one
- **Two-way lorebook sync** (**character → Lorebook → Attach**): saved edits on a linked character update the library book and every other linked character, and **Open in vault** takes an **Auto** snapshot first
- **Settings that keep your changes**: closing with unsaved edits asks **Keep editing** or **Discard**, and saving waits until settings load

[Release 1.8.3 →](/releases/v1.8.3) · [AI Creation Studio →](/features/ai-creation-studio#generation-prompts) · [Lorebook Vault →](/features/lorebook-vault#how-they-stay-in-sync)

---

Older releases are on [GitHub](https://github.com/spaceman2408/CharacterVault/releases) and in the [Full Changelog](/changelog).

## See Also

- [Full Changelog](/changelog)
- [Getting Started](/getting-started/installation)

# AI Setup

Character Vault's AI features (Orion, the Agent, and the AI toolbar) require an AI provider endpoint. This guide covers every option in the settings panel.

## Opening Settings

1. Open a character in the workspace.
2. Click **Settings** in the workspace header.
3. The settings modal opens with five tabs: **AI Config**, **Sampler**, **Prompts**, **Studio**, and **Sections**.
4. Click **Save Settings** at the bottom when you're done. Changes don't take effect until you save.

You can close the panel with **Cancel** or `Escape` to discard changes.

## AI Config Tab

### Security Notice

At the top of the AI Config tab, a security banner reminds you that your API key is stored locally in your browser. Click **Clear AI Settings** to remove all AI configuration (key, URL, model) — your characters are not affected. A confirmation step prevents accidental clears. Prompt templates, **per-prompt model mappings**, and the **Agent** model mapping on the Prompts tab are kept (they do not store secrets).

### API Base URL

Choose a provider preset from the dropdown, or select **Custom URL** to type in any OpenAI-compatible endpoint:

| Preset | Base URL | When to Use |
| :--- | :--- | :--- |
| **Nano-GPT** | `https://nano-gpt.com/api/v1` | NanoGPT hosted endpoint. Supports provider selection and subscription billing. |
| **Synthetic** | `https://api.synthetic.new/v1` | OpenAI-compatible endpoint. Prefer `syn:` aliases so you always get the latest recommended model. |
| **OpenRouter** | `https://openrouter.ai/api/v1` | OpenRouter multi-model gateway. Use `org/model` slugs such as `openai/gpt-4o`. |
| **Minimax** | `https://api.minimax.io/v1` | OpenAI-compatible endpoint. API keys start with `sk-cp`. |
| **LM Studio / localhost** | `http://127.0.0.1:1234/v1` | Local inference with LM Studio. |
| **Custom URL** | Any URL | Any OpenAI-compatible endpoint (e.g., a self-hosted API). |

When you switch presets, the text field below updates. Your API key and model selection are **remembered per base URL** — switching back to a previous provider restores your saved key and model.

The helper text below the URL field changes based on the selected preset. For custom URLs, it reads: "Pick a preset above or enter a custom OpenAI-compatible endpoint."

### API Key

Enter your API key in the masked field. It looks like a password, but it is a normal text field so browsers do not treat **Save Settings** as a login. The key is saved per base URL — if you switch providers and come back, your key is restored.

Some presets include a link to the provider's key management page — click **Get your key ↗** next to the API Key label.

::: warning
Your API key is stored locally in your browser's storage. It could be accessed by malicious browser extensions or if someone gains physical access to your unlocked computer.
:::

### Sign in with NanoGPT (PKCE)

When the **Nano-GPT** preset is selected, a **Sign in with NanoGPT** button appears next to the API Key field. Instead of pasting an API key, you can sign in with your NanoGPT account — CharacterVault walks you through a secure OAuth flow using PKCE (Proof Key for Code Exchange), no client secret stored anywhere, no password ever seen by this app.

**How it works**

1. Click **Sign in with NanoGPT**. A new browser window/tab opens to NanoGPT's authorization page.
2. Approve the request on NanoGPT's site.
3. NanoGPT redirects back to a small relay page that returns the authorization code to CharacterVault.
4. CharacterVault exchanges the code (plus the one-time PKCE verifier) for an API key and drops it into the API Key field for you.
5. Your available models are **automatically fetched** — the model dropdown is populated as soon as sign-in completes, so you can pick a model and start chatting immediately.

The success toast confirms the result, e.g. **"Signed in. Fetched 47 models."**

::: warning Browser popups must be allowed
The sign-in flow opens a new window or tab. If your browser blocks popups for this site, the button will appear to do nothing. Allow popups for `spaceman2408.github.io` (or your hosted origin) and try again. If you previously dismissed the permission, click the popup-blocker icon in the address bar to allow them for this site.
:::

::: warning Mobile browser support
PKCE sign-in works best on desktop browsers. Mobile support depends on the browser:

- **Chrome on Android** — Works. The sign-in opens in a new tab and returns successfully.
- **Other mobile browsers** — May work, may not. Some mobile browsers handle popup/tab handoff differently and can fail to relay the authorization code back to the app. If sign-in doesn't complete on your phone, paste an API key manually instead.

If you're on mobile and the button doesn't progress past "Signing in...", open the page in Chrome or paste your API key directly into the API Key field.
:::

You can still paste an API key manually at any time — the two flows are interchangeable.

### Model

Click the model field (or **Fetch models**) to load and choose a model. Selection opens a **sheet** (bottom sheet on phones, centered dialog on larger screens) so the list is not clipped by the settings panel:

- **Search** — Type in the filter field to narrow models by name or ID. On mobile, the search field uses a large enough font to avoid iOS zoom.
- **Keyboard** — Press `Enter` to select the first match, `Escape` to close the sheet only (not the whole Settings panel).
- **Tap outside / Close** — Dismiss without changing the selection.

Model selections are saved per base URL, so switching providers remembers your last chosen model for each.

This is your **global default** model, used by Orion chat, AI Creation Studio, the Agent when its mapping is Default, and any toolbar prompt still set to **Default** on the [Prompts tab](#prompts-tab).

On **Synthetic**, `syn:` aliases (Large text, Small text, and vision variants) are listed first; embedding-only models are omitted. On **OpenRouter**, the picker uses display names and drops non-text models. Both adapters seed reasoning-effort allowlists when the catalog reports them.

### Provider (NanoGPT Only)

Some NanoGPT models support **provider selection** — choosing which backend serves the request. When available, a **Provider** control appears below the model selector. It uses the same sheet pattern as the model picker. Each provider shows its per-1k-token pricing for input and output.

- **Platform default** — Let NanoGPT auto-select the best provider.
- **Specific provider** — Pick a named provider to control cost or latency.

Provider preferences are saved per model — switching models remembers your choice.

### NanoGPT Account overview

When the Nano-GPT preset is selected, a **NanoGPT Account** card shows:

- **Balance** (USD / Nano) from NanoGPT’s check-balance API  
- **Subscription status** (active / grace / not active) and weekly input-token quota when available  

Refresh is rate-limited (about 30 seconds). Closing and reopening Settings within about a minute reuses the last result so the APIs are not hit again.

**Subscription status and weekly tokens:** On the **official hosted app** and on **localhost** (`npm run dev`), this works with no extra setup. You only need a small proxy if you **self-host a production build** of CharacterVault. Full walkthrough: [NanoGPT Usage Proxy (Self-Hosted Production)](/configuration/nanogpt-usage-proxy).

### Synthetic Usage

When the **Synthetic** preset is selected, a **Synthetic Usage** card shows live subscription limits from Synthetic’s `/v2/quotas` API:

- **Five-hour requests** — rolling request count, remaining, and next tick
- **Weekly credits** — remaining credit amount and next regeneration time when Synthetic reports them

Refresh is rate-limited (about 30 seconds). Closing and reopening Settings within about a minute reuses the last result. Cheaper models spend a fraction of one request. The card stays a stable size while loading so the rest of the settings panel doesn’t jump.

Paste a Synthetic API key to load usage. Billing details live on [synthetic.new/billing](https://synthetic.new/billing).

### OpenRouter Usage

When the **OpenRouter** preset is selected, an **OpenRouter Usage** card reads `GET /api/v1/key` for the current inference key:

- **Spend** — today, this week, this month, and all time (USD)
- **Key spending limit** — used / remaining and whether the cap resets, when the key has one
- **Free-tier notice** — if OpenRouter reports a free-tier key, models ending in `:free` are limited to 20 requests per minute and 50 per day until you buy credits
- **Expiry** — shown when the key has an expiration date

Refresh is rate-limited (about 30 seconds). Closing and reopening Settings within about a minute reuses the last result. Spend is this **API key’s** OpenRouter credit usage — a normal inference key does not return account balance. Manage credits at [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits).

### NanoGPT Options

When the NanoGPT preset is selected, two additional toggles appear:

- **Subscription models only** — When on, clicking **Fetch** only returns models included in your NanoGPT subscription. When off, paid models are also listed.
- **Pay-as-you-go billing** — Force pay-as-you-go pricing even with an active subscription. This is required for provider selection on subscription-covered models.

### Advanced Options

Three toggle switches control streaming and reasoning:

| Option | Default | What It Does |
| :--- | :--- | :--- |
| **Enable streaming** | Off | AI responses appear in real-time as they're generated. When off, the full response appears at once after completion. |
| **Enable reasoning** | Off | Enables thinking/reasoning mode for models that support it (DeepSeek, Qwen/QwQ, OpenAI o1/o3/o4-mini, OpenRouter reasoning models). |
| **Show reasoning** | On | When reasoning is enabled, the AI's thinking process is shown in a collapsible section before the response. |

When reasoning is enabled, a **Reasoning Effort** dropdown appears (Minimal through Max / Extra high). Which levels a model accepts depends on the provider: GPT-style models often use Minimal–High (and Extra high), while many SOTA thinking models (DeepSeek V4, GLM-5.x, Kimi, etc.) mainly use High and Max.

Full guide: [Reasoning Effort](/configuration/reasoning-effort).

## Sampler Tab

See [Sampler Settings](/configuration/sampler-settings) for a full explanation of every parameter.

The Sampler tab includes:

- **Quick Presets** — One-click **Creative**, **Balanced**, or **Factual** presets.
- **Primary Samplers** — Temperature, Top P, Min P, Top K sliders.
- **Secondary Samplers** — Repetition Penalty, Max Tokens sliders, and Context Length dropdown.

## Prompts Tab

The Prompts tab lets you pick a **model for the Agent**, edit the **user prompt templates** used by each AI toolbar operation, and optionally **route each operation to a different endpoint and model**.

### Agent model

The **Agent** card at the top of the tab uses the same endpoint and model picker as a toolbar op:

- **Default (AI Config)** keeps the global model.
- Or choose a preset (or custom URL) you already saved a key for, then pick or type a model ID.

Character Agent and lorebook Agent share this mapping. Sampler, streaming, and reasoning stay global. See [AI Agent](/features/ai-agent#model-for-agent).

Prompts below that are divided into two groups:

- **Primary Operations** — Enhance, Rephrase, Custom. Each prompt is in a collapsible section. Click to expand and edit in a text area.
- **Polish Operations** — Shorten, Lengthen, Vivid, Emotion, Fix. Same collapsible layout.

### Prompt text

Every prompt must contain `${text}` — this is where your selected text gets inserted. The Custom (Instruct) prompt also requires `${instruction}` for your typed instruction. Validation errors appear inline if required placeholders are missing.

### Per-prompt model routing

Under each expanded prompt, **Model for this prompt** controls which API endpoint and model run that operation:

| Control | What it does |
| :--- | :--- |
| **Endpoint** | **Default (AI Config)** uses your global base URL + model. Or pick Nano-GPT, Synthetic, OpenRouter, Minimax, LM Studio / localhost, or a custom URL you already configured. |
| **Model** | When not on Default: open the same style of model sheet as AI Config, **Fetch models** for that endpoint, or type a model ID manually. |

**Examples**

- Map **Fix** to a fast NanoGPT model for cheap grammar passes.
- Map **Rephrase** to OpenRouter’s DeepSeek (or another host) while Enhance stays on your global model.
- Leave most ops on Default and only override the ones that need a specialist model.

**Requirements**

- API keys are still managed on the **AI Config** tab (including per–base URL memory). The Prompts tab only **selects** among endpoints that already have a key (or local endpoints that do not need one).
- A mapped prompt must have both an endpoint and a non-empty model ID, or Save is blocked.
- Collapsed prompt headers show `→ {modelId}` when a mapping is set.

**What uses which model**

| Surface | Uses |
| :--- | :--- |
| **Agent** (character or lorebook chat) | Prompts tab **Agent** mapping, or global default |
| AI toolbar ops (Enhance, Fix, and the rest) | Per-prompt map, or global default |
| Lorebook **AI key generation** (✨) | The **Custom / instruct** mapping if set, otherwise global |
| **Orion** chat | Always global AI Config |
| **AI Creation Studio** | Always global AI Config |

Sampler, streaming, and reasoning settings remain global (Sampler / AI Config tabs).

**Clear AI Settings** removes keys and the global model, but keeps your prompt **text** and **model mappings** (you will need keys again before a mapped endpoint works).

For full details on placeholders and the toolbar, see [Customizing AI Operation Prompts](/features/editor#customizing-ai-operation-prompts).

## Studio Tab

The Studio tab controls UI preferences for the AI Creation Studio — primarily the **I'm Feeling Lucky** vortex animation. Toggle it off if the visual effect gets distracting or slows down your device.

## Sections Tab

The Sections tab lets you customize the editor's section tab strip. Hide tabs you don't use, reorder the rest, and reset to defaults at any time. See [Section Tab Layout](/configuration/section-layout) for the full guide.


## Missing /v1 Detection

If your API requests fail and the base URL doesn't end in `/v1`, the error message suggests adding `/v1` to the URL. This catches a common configuration mistake with OpenAI-compatible endpoints.

## Context Length & Max Tokens

These are set on the **Sampler** tab:

- **Context Length** — Dropdown from 2K to 1M tokens, plus a Custom option (4,096–1,000,000). This is the total window (input + output).
- **Max Tokens** — Slider from 100 to 8,192. The maximum tokens the AI will generate per response.

::: warning
If Max Tokens is too close to Context Length, you'll see a warning. The AI needs room for both input and output. A 100-token safety margin is reserved automatically.
:::

## Troubleshooting Context Warnings

| Warning | Cause | Fix |
| :--- | :--- | :--- |
| **"Selection is too long"** | Selected text exceeds the available context window | Select less text or increase Context Length |
| **"Please adjust Max Tokens..."** | Max Tokens is too close to Context Length | Increase Context Length on the Sampler tab |
| **"AI needs a larger context..."** | System instructions consume the entire context window | Increase Context Length or decrease Max Tokens |

### How Truncation Works

When the total input exceeds the context window:

- **In Chat (Orion)**: The system prompt (Orion persona) and current question are kept. Context entries from the AI Context panel (pinned sections, then custom context) are included next. Older conversation history is dropped first.
- **In Agent chat**: Catalogs, optional custom context, and the current request stay. Full field and entry bodies are read with tools and counted in the live meter. Raise Context Length for large books.
- **In Editor (AI Toolbar)**: The selected text is kept. Context entries are dropped first if space is tight.

Pin fewer sections, trim custom context, or raise **Context Length** on the Sampler tab if you hit limits often. See [AI Context Panel](/features/ai-context).

## Next Steps

- [AI Context Panel](/features/ai-context) — sections, custom context, tokens
- [Use the AI assistant](/features/ai-assistant)
- [AI Agent](/features/ai-agent)
- [Adjust sampler settings](/configuration/sampler-settings)
- [Customize AI operation prompts & model routing](/features/editor#customizing-ai-operation-prompts)


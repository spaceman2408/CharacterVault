# AI Setup

Character Vault's AI features — the Orion assistant and AI toolbar — require an AI provider endpoint. This guide covers every option in the settings panel.

## Opening Settings

1. Open a character in the workspace.
2. Click **Settings** in the workspace header.
3. The settings modal opens with three tabs: **AI Config**, **Sampler**, and **Prompts**.
4. Click **Save Settings** at the bottom when you're done. Changes don't take effect until you save.

You can close the panel with **Cancel** or `Escape` to discard changes.

## AI Config Tab

### Security Notice

At the top of the AI Config tab, a security banner reminds you that your API key is stored locally in your browser. Click **Clear AI Settings** to remove all AI configuration (key, URL, model) — your characters are not affected. A confirmation step prevents accidental clears.

### API Base URL

Choose a provider preset from the dropdown, or select **Custom URL** to type in any OpenAI-compatible endpoint:

| Preset | Base URL | When to Use |
| :--- | :--- | :--- |
| **Nano-GPT** | `https://nano-gpt.com/api/v1` | NanoGPT hosted endpoint. Supports provider selection and subscription billing. |
| **OpenRouter** | `https://openrouter.ai/api/v1` | OpenRouter multi-model gateway. |
| **Minimax** | `https://api.minimax.io/v1` | OpenAI-compatible endpoint. API keys start with `sk-cp`. |
| **LM Studio / localhost** | `http://127.0.0.1:1234/v1` | Local inference with LM Studio. |
| **Custom URL** | Any URL | Any OpenAI-compatible endpoint (e.g., a self-hosted API). |

When you switch presets, the text field below updates. Your API key and model selection are **remembered per base URL** — switching back to a previous provider restores your saved key and model.

The helper text below the URL field changes based on the selected preset. For custom URLs, it reads: "Pick a preset above or enter a custom OpenAI-compatible endpoint."

### API Key

Enter your API key in the password field. The key is saved per base URL — if you switch providers and come back, your key is restored.

Some presets include a link to the provider's key management page — click **Get your key ↗** next to the API Key label.

::: warning
Your API key is stored locally in your browser's storage. It could be accessed by malicious browser extensions or if someone gains physical access to your unlocked computer.
:::

### Model

Click the **Fetch** button to load available models from your provider. A searchable dropdown appears:

- **Search** — Type in the filter field to narrow models by name or ID.
- **Keyboard** — Press `Enter` to select the first match, `Escape` to close.
- **Manual entry** — If you know a model ID, you can type it directly.

Model selections are saved per base URL, so switching providers remembers your last chosen model for each.

### Provider (NanoGPT Only)

Some NanoGPT models support **provider selection** — choosing which backend serves the request. When available, a **Provider** dropdown appears below the model selector. Each provider shows its per-1k-token pricing for input and output.

- **Platform default** — Let NanoGPT auto-select the best provider.
- **Specific provider** — Pick a named provider to control cost or latency.

Provider preferences are saved per model — switching models remembers your choice.

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

When reasoning is enabled, a **Reasoning Effort** dropdown appears:

| Level | What It Does |
| :--- | :--- |
| **Low** | Faster responses, less reasoning depth |
| **Medium** | Balanced reasoning (default) |
| **High** | More thorough reasoning, slower responses |

This controls reasoning depth for OpenAI o1/o3/o4-mini and OpenRouter reasoning models.

## Sampler Tab

See [Sampler Settings](/configuration/sampler-settings) for a full explanation of every parameter.

The Sampler tab includes:

- **Quick Presets** — One-click **Creative**, **Balanced**, or **Factual** presets.
- **Primary Samplers** — Temperature, Top P, Min P, Top K sliders.
- **Secondary Samplers** — Repetition Penalty, Max Tokens sliders, and Context Length dropdown.

## Prompts Tab

The Prompts tab lets you edit the system prompts used by each AI toolbar operation. Prompts are divided into two groups:

- **Primary Operations** — Enhance, Rephrase, Custom. Each prompt is in a collapsible section. Click to expand and edit in a text area.
- **Polish Operations** — Shorten, Lengthen, Vivid, Emotion, Fix. Same collapsible layout.

Every prompt must contain `${text}` — this is where your selected text gets inserted. The Custom (Instruct) prompt also requires `${instruction}` for your typed instruction. Validation errors appear inline if required placeholders are missing.

For full details on how prompts work with the AI toolbar, see [Customizing AI Operation Prompts](/features/editor#customizing-ai-operation-prompts).


## Missing /v1 Detection

If your API requests fail and the base URL doesn't end in `/v1`, the error message suggests adding `/v1` to the URL. This catches a common configuration mistake with OpenAI-compatible endpoints.

## Context Length & Max Tokens

These are set on the **Sampler** tab:

- **Context Length** — Dropdown from 2K to 128K tokens. This is the total window (input + output).
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

- **In Chat (Orion)**: The system prompt (Orion persona) and current question are kept. Context entries are included next. Older conversation history is dropped first.
- **In Editor (AI Toolbar)**: The selected text is kept. Context entries are dropped first if space is tight.

## Next Steps

- [Use the AI assistant](/features/ai-assistant)
- [Adjust sampler settings](/configuration/sampler-settings)
- [Customize AI operation prompts](/features/editor#customizing-ai-operation-prompts)


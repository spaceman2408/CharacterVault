# Sampler Settings

Sampler settings control how the AI generates text — balancing creativity and focus. Character Vault keeps to the standard OpenAI parameters that nearly every provider accepts.

## Accessing Sampler Settings

1. Open a character in the workspace.
2. Click **Settings** in the workspace header.
3. Click the **Sampler** tab.

## Quick Presets

Three built-in presets set Temperature, Top P, and Max Tokens with one click. They **do not change** your current context length.

| Preset | Temp | Top P | Max Tokens | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **Creative** | 1.1 | 0.95 | 2048 | Brainstorming, storytelling, expanding descriptions |
| **Balanced** | 0.8 | 1.0 | 2048 | General-purpose writing and editing |
| **Factual** | 0.5 | 0.9 | 1024 | Grammar fixes, factual rewrites, concise edits |

Select a preset to apply its values, then fine-tune individual parameters as needed.

## Primary Samplers

### Temperature

Controls randomness in generation. Lower values produce more focused, deterministic output. Higher values produce more creative, varied output.

| Value | Behavior |
| :--- | :--- |
| 0.0 | Fully deterministic (not recommended — can produce repetitive text) |
| 0.3 – 0.5 | Focused and consistent (Factual preset uses 0.5) |
| 0.7 – 0.8 | Balanced everyday writing (Balanced preset uses 0.8) |
| 1.0 | Neutral / raw distribution (app default when no preset is applied) |
| 1.1 – 1.3 | Creative and varied (Creative preset uses 1.1) |
| 1.5 – 2.0 | Highly unpredictable — pair with a lower Top P |

**Range**: 0.0 – 2.0 (step: 0.1)

### Top P

Nucleus sampling — considers only tokens whose cumulative probability is below the threshold. Lower values restrict output to more likely tokens.

| Value | Behavior |
| :--- | :--- |
| 0.5 | Very focused |
| 0.9 | Mild focus (Factual preset) |
| 0.95 | Slightly open (Creative preset) |
| 1.0 | No top-p filtering (Balanced / app default) |

**Range**: 0.0 – 1.0 (step: 0.05)

## Output & Context

### Max Tokens

The maximum number of tokens the AI will generate in a single response.

- Lower values (100–500) produce concise replies.
- Medium values (1024–2048) work well for most character content.
- Higher values (4096–8192) allow detailed, long-form responses.

**Range**: 100 – 8,100 (step: 100)

With reasoning on, many models count their thinking against Max Tokens, so a long think can use it all up and leave the reply cut off or empty. When nothing was written, the toolbar says the model used up Max Tokens before writing any text. Raise Max Tokens, or lower [Reasoning Effort](/configuration/reasoning-effort). The Agent uses its own larger output budget instead of this slider.

On `api.openai.com` this is sent as `max_completion_tokens`, which OpenAI's reasoning models require. If another host rejects `max_tokens` and asks for `max_completion_tokens`, Character Vault renames it, retries, and keeps using the new name for that model until you reload.

### Context Length

The total token window for AI requests (input + output combined). Choose a preset from the dropdown, or select **Custom…** to enter any value from 4,096 to 1,000,000 tokens.

| Option | Token Count |
| :--- | :--- |
| 2K | 2,048 |
| 4K | 4,096 |
| 8K | 8,192 (default) |
| 16K | 16,384 |
| 32K | 32,768 |
| 64K | 65,536 |
| 128K | 128,000 |
| 256K | 256,000 |
| 512K | 512,000 |
| 1M | 1,000,000 |
| Custom… | Any integer from 4,096 to 1,000,000 |

Choose a context length that matches or is lower than the maximum supported by your selected model. Larger windows allow the AI to work with more text but cost more and take longer. Providers may reject requests if the window exceeds what the model supports.

::: warning
The Max Tokens slider goes up to 8,100; imported values are capped at 8,192 on save. Context Length is clamped to 2,048–1,000,000 on save (custom entries require at least 4,096 in the UI).
:::

## Tips

- **For the AI assistant (Orion)**: A balanced or creative preset works well for brainstorming character details.
- **For the AI toolbar**: Factual or balanced is often better for grammar fixes and rewrites; creative is better for vivid/emotion operations.
- **High Temperature**: Pair creative temperatures (≈1.1+) with a Top P around 0.95 so coherence holds while variety stays high.
- **Rejected parameters**: If a host rejects a parameter, Character Vault removes it and retries (up to 3 retries). Some reasoning models ignore or reject Temperature and Top P.

## Next Steps

- [Configure your AI provider](/configuration/ai-setup)
- [Use the AI assistant](/features/ai-assistant)
- [AI Agent](/features/ai-agent)

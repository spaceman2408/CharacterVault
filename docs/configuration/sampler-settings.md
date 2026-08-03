# Sampler Settings

Sampler settings control how the AI generates text — balancing creativity, coherence, and diversity. Character Vault exposes the most commonly used sampling parameters.

## Accessing Sampler Settings

1. Open a character in the workspace.
2. Click **Settings** in the workspace header.
3. Click the **Sampler** tab.

## Quick Presets

Three built-in presets apply modern sampling combinations with one click. They follow a **min-p–first** stack (top-k off, light repetition penalty) and **do not change** your current context length.

| Preset | Temp | Min P | Top P | Top K | Rep Pen | Max Tokens | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Creative** | 1.1 | 0.05 | 0.95 | 0 | 1.05 | 2048 | Brainstorming, storytelling, expanding descriptions |
| **Balanced** | 0.8 | 0.05 | 1.0 | 0 | 1.05 | 2048 | General-purpose writing and editing |
| **Factual** | 0.5 | 0.1 | 0.9 | 0 | 1.05 | 1024 | Grammar fixes, factual rewrites, concise edits |

Select a preset to apply its values, then fine-tune individual parameters as needed.

## Primary Samplers

These are the most commonly adjusted parameters:

### Temperature

Controls randomness in generation. Lower values produce more focused, deterministic output. Higher values produce more creative, varied output.

| Value | Behavior |
| :--- | :--- |
| 0.0 | Fully deterministic (not recommended — can produce repetitive text) |
| 0.3 – 0.5 | Focused and consistent (Factual preset uses 0.5) |
| 0.7 – 0.8 | Balanced everyday writing (Balanced preset uses 0.8) |
| 1.0 | Neutral / raw distribution (app default when no preset is applied) |
| 1.1 – 1.3 | Creative and varied (Creative preset uses 1.1) |
| 1.5 – 2.0 | Highly unpredictable — pair with Min P |

**Range**: 0.0 – 2.0 (step: 0.1)

### Top P

Nucleus sampling — considers only tokens whose cumulative probability is below the threshold. Lower values restrict output to more likely tokens.

| Value | Behavior |
| :--- | :--- |
| 0.5 | Very focused — rarely needed with Min P |
| 0.9 | Mild focus (Factual preset) |
| 0.95 | Slightly open (Creative preset) |
| 1.0 | No top-p filtering — let Min P handle truncation (Balanced / app default) |

**Range**: 0.0 – 1.0 (step: 0.05)

### Min P

Minimum probability threshold. Filters out tokens with probabilities below this percentage of the top token's probability. Unlike Top P, this works relative to the best token, making it more adaptive at different probability scales.

| Value | Behavior |
| :--- | :--- |
| 0.0 | No filtering (app default — fully open) |
| 0.05 | Recommended modern default (Creative / Balanced presets) |
| 0.1 | Tighter relative floor (Factual preset) |

**Range**: 0.0 – 1.0 (step: 0.01)

### Top K

Limits token selection to the K most likely candidates. Lower values restrict output more aggressively.

| Value | Behavior |
| :--- | :--- |
| 0 | Disabled (modern default; all quick presets use this) |
| 20 – 40 | Legacy hard cutoff — prefer Min P instead |
| 100 | Very permissive hard cutoff |

**Range**: 0 – 100 (step: 1)

::: tip
Modern sampling stacks usually disable Top K (`0`) and rely on **Min P** (optionally with a mild Top P). Character Vault's quick presets follow that approach.
:::

## Secondary Samplers

### Repetition Penalty

Penalizes repeated tokens and phrases. Values above 1.0 discourage repetition; values at 1.0 disable the penalty.

| Value | Behavior |
| :--- | :--- |
| 1.0 | No penalty (app default) |
| 1.05 | Light anti-repetition (all quick presets) |
| 1.1 | Moderate — use if the model loops |
| 1.2+ | Strong — can produce awkward or stilted phrasing |

**Range**: 1.0 – 2.0 (step: 0.05)

### Max Tokens

The maximum number of tokens the AI will generate in a single response.

- Lower values (100–500) produce concise replies.
- Medium values (1024–2048) work well for most character content.
- Higher values (4096–8192) allow detailed, long-form responses.

**Range**: 100 – 8,100 (step: 100)

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
Max Tokens is capped at 8,192 on save. Context Length is clamped to 2,048–1,000,000 on save (custom entries require at least 4,096 in the UI).
:::

## Tips

- **For the AI assistant (Orion)**: A balanced or creative preset works well for brainstorming character details.
- **For the AI toolbar**: Factual or balanced is often better for grammar fixes and rewrites; creative is better for vivid/emotion operations.
- **High Temperature + Min P**: Pair creative temperatures (≈1.1+) with Min P ≈0.05 so coherence holds while variety stays high.
- **Prefer Min P over Top K**: Top K is a fixed hard cutoff; Min P adapts to model confidence and is the modern primary truncation sampler.
- **Repetition Penalty**: Keep it light (≈1.05). Values above 1.15 can start to produce awkward phrasing.
- **Non-standard parameters**: Some models don't support `min_p`, `top_k`, `repetition_penalty`, or reasoning parameters. If a model rejects these, Character Vault automatically strips them and retries the request (up to 3 attempts).

## Next Steps

- [Configure your AI provider](/configuration/ai-setup)
- [Use the AI assistant](/features/ai-assistant)

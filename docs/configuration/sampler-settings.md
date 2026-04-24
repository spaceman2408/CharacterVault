# Sampler Settings

Sampler settings control how the AI generates text — balancing creativity, coherence, and diversity. Character Vault exposes the most commonly used sampling parameters.

## Accessing Sampler Settings

1. Open a character in the workspace.
2. Click **Settings** in the workspace header.
3. Click the **Sampler** tab.

## Quick Presets

Three built-in presets apply common parameter combinations with one click:

| Preset | Temperature | Context | Max Tokens | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **Creative** | 0.9 | 4K | 2048 | Brainstorming, storytelling, expanding descriptions |
| **Balanced** | 0.7 | 4K | 2048 | General-purpose writing and editing |
| **Factual** | 0.3 | 4K | 1024 | Grammar fixes, factual rewrites, concise edits |

Select a preset to apply its values, then fine-tune individual parameters as needed.

## Primary Samplers

These are the most commonly adjusted parameters:

### Temperature

Controls randomness in generation. Lower values produce more focused, deterministic output. Higher values produce more creative, varied output.

| Value | Behavior |
| :--- | :--- |
| 0.0 | Fully deterministic (not recommended — can produce repetitive text) |
| 0.3 – 0.5 | Focused and consistent |
| 0.7 | Balanced (default) |
| 0.9 – 1.0 | Creative and varied |
| 1.5 – 2.0 | Highly unpredictable |

**Range**: 0.0 – 2.0 (step: 0.1)

### Top P

Nucleus sampling — considers only tokens whose cumulative probability is below the threshold. Lower values restrict output to more likely tokens.

| Value | Behavior |
| :--- | :--- |
| 0.5 | Very focused — considers only the most likely tokens |
| 0.95 | Permissive (Creative preset default) |
| 1.0 | No filtering — all tokens considered (Balanced preset default) |

**Range**: 0.0 – 1.0 (step: 0.05)

### Min P

Minimum probability threshold. Filters out tokens with probabilities below this percentage of the top token's probability. Unlike Top P, this works relative to the best token, making it more adaptive at different probability scales.

| Value | Behavior |
| :--- | :--- |
| 0.0 | No filtering |
| 0.05 | Light filtering (default) |
| 0.1 | Moderate filtering (Factual preset) |

**Range**: 0.0 – 1.0 (step: 0.01)

### Top K

Limits token selection to the K most likely candidates. Lower values restrict output more aggressively.

| Value | Behavior |
| :--- | :--- |
| 20 | Very focused (Factual preset) |
| 40 | Moderate (Balanced preset default) |
| 50 | Permissive (Creative preset) |
| 100 | Very permissive — nearly all tokens considered |

**Range**: 1 – 100 (step: 1)

## Secondary Samplers

### Repetition Penalty

Penalizes repeated tokens and phrases. Values above 1.0 discourage repetition; values at 1.0 disable the penalty.

| Value | Behavior |
| :--- | :--- |
| 1.0 | No penalty |
| 1.05 | Light anti-repetition (Creative preset) |
| 1.1 | Moderate (Balanced preset default) |
| 1.2 | Strong (Factual preset) |
| 1.5+ | May produce awkward or stilted phrasing |

**Range**: 1.0 – 2.0 (step: 0.05)

### Max Tokens

The maximum number of tokens the AI will generate in a single response.

- Lower values (100–500) produce concise replies.
- Medium values (1024–2048) work well for most character content.
- Higher values (4096–8192) allow detailed, long-form responses.

**Range**: 100 – 8,192 (step: 100)

### Context Length

The total token window for AI requests (input + output combined). This is selected from a dropdown with predefined sizes:

| Option | Token Count |
| :--- | :--- |
| 2K | 2,048 |
| 4K | 4,096 (default) |
| 8K | 8,192 |
| 16K | 16,384 |
| 32K | 32,768 |
| 64K | 65,536 |
| 128K | 131,072 |

Choose a context length that matches or is lower than the maximum supported by your selected model. Larger windows allow the AI to work with more text but cost more and take longer.

::: warning
Max Tokens is capped at 8,192 on save. If you enter a value above this, it will be clamped down automatically.
:::

## Tips

- **For the AI assistant (Orion)**: A balanced or creative preset works well for brainstorming character details.
- **For the AI toolbar**: Factual or balanced is often better for grammar fixes and rewrites; creative is better for vivid/emotion operations.
- **High Temperature + Min P**: Using Min P alongside a higher Temperature helps maintain coherence while allowing creative output.
- **Repetition Penalty**: Values above 1.2 can start to produce awkward phrasing. Use sparingly.
- **Non-standard parameters**: Some models don't support `min_p`, `top_k`, `repetition_penalty`, or reasoning parameters. If a model rejects these, Character Vault automatically strips them and retries the request (up to 3 attempts).

## Next Steps

- [Configure your AI provider](/configuration/ai-setup)
- [Use the AI assistant](/features/ai-assistant)

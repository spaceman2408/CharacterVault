# Reasoning Effort

Reasoning effort controls **how hard the model thinks** before it writes a final answer. Character Vault sends this as part of the chat request when **Enable reasoning** is on (Settings → AI Config → Advanced Options).

This page explains what each level means, which models use which levels, and how Character Vault handles providers that only accept a subset of values.

## Enable reasoning first

| Setting | What it does |
| :--- | :--- |
| **Enable reasoning** | Turns on thinking / chain-of-thought for models that support it. Off by default. |
| **Show reasoning** | When on, the model’s thinking is shown in a collapsible section before the answer. |
| **Reasoning Effort** | How much thinking budget to request (only shown when reasoning is enabled). |

Reasoning is useful for harder tasks: multi-step rewrites, consistency checks, complex character logic, or long instructions. It is usually slower and uses more tokens (and cost) than a normal reply.

::: tip
If you only need quick grammar or short polish, leave reasoning **off**. Turn it on when quality matters more than speed.
:::

## What the levels mean

Character Vault offers six effort values. Higher effort generally means **more thinking tokens**, **longer waits**, and often **better answers** on hard problems. Exact behavior is decided by the model and the API gateway (NanoGPT, OpenRouter, OpenAI, etc.).

| Level | In short | Typical use |
| :--- | :--- | :--- |
| **Minimal** | Almost no thinking. Fastest. | Tiny edits, classification-style tasks, when you want speed. |
| **Low** | Light thinking. Still quick. | Simple rewrites, short expansions. |
| **Medium** | Balanced depth and speed. **Default.** | General toolbar and chat work. |
| **High** | Thorough thinking. | Complex edits, long context, careful reasoning. |
| **Extra high (`xhigh`)** | Peak depth on **OpenAI-style** effort ladders. | Hardest tasks on GPT-5.x / o-series via OpenAI or OpenRouter. |
| **Max** | Peak depth on **many open / SOTA** APIs. | Hardest tasks on DeepSeek V4, GLM-5.x, Kimi K3, and similar. |

### Why both “Extra high” and “Max”?

Providers do not share one enum:

- **OpenAI-style** APIs often use `minimal` → `low` → `medium` → `high` → **`xhigh`** (and sometimes `none`).
- **DeepSeek V4**, **GLM-5 / 5.2**, and several other SOTA stacks use a shorter ladder, often only **`high`** and **`max`** (plus turning thinking off).
- **Kimi K2.5 / K2.6** often only toggle thinking on or off; multi-level effort may be ignored or rejected. **Kimi K3** may only accept **`max`** today.

Character Vault exposes both **Extra high** and **Max** so you can pick the name your model’s API expects. You do not need to memorize every provider.

## Which models use which levels?

This is a practical guide, not a guarantee. Gateways can remap or restrict values.

### GPT and “OSS-style” ladders

Models that follow an OpenAI-like effort scale (many **GPT-5.x**, **o-series**, and some **open weights** served with the same API shape) usually understand:

- **Minimal, Low, Medium, High** for everyday control  
- **Extra high (`xhigh`)** for maximum depth on that ladder  

**Medium** is a safe default for these models.

### SOTA / thinking-first models (DeepSeek, GLM, Kimi, etc.)

Newer flagship thinking models often do **not** support the full low/medium ladder:

| Family (examples) | Typical effort values | Notes |
| :--- | :--- | :--- |
| **DeepSeek V4** (thinking / `:thinking` variants) | `high`, `max` (and sometimes `none` to disable) | Official APIs often map `low`/`medium` → `high` and `xhigh` → `max`. Some gateways instead **reject** `medium` and list only `none`, `high`, `max`. |
| **GLM-5 / GLM-5.2** | `high`, `max` (`max` is often the model default) | Use **High** for cost/latency, **Max** for hardest agentic or coding-style work. |
| **Kimi K2.5 / K2.6** | Thinking on/off more than multi-level effort | Effort dropdown may have little effect; enable reasoning still matters for thinking output. |
| **Kimi K3** | Often **`max` only** today | Pick **Max** when using these IDs. |
| **OpenRouter** unified `reasoning.effort` | Can include `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` | Per-model support varies; OpenRouter may map your choice to what the upstream model allows. |

### Quick rule of thumb

| You are using… | Prefer… |
| :--- | :--- |
| GPT / o-series / OpenAI-style | Minimal → High, or **Extra high** for max depth |
| DeepSeek V4, GLM-5.x, many SOTA open models | **High** or **Max** |
| Not sure | Start with **Medium** or **High**; if the request fails on effort, Character Vault remaps for you |

## Automatic remapping

Character Vault always sends the effort you selected when reasoning is on. If the provider returns an error like “unsupported `reasoning_effort`” and lists allowed values, Character Vault:

1. Picks the **closest supported** level (never maps down to “no thinking” while reasoning is enabled).
2. Treats **Max** and **Extra high** as **peers** when only one of them is allowed.
3. **Remembers** rejections for that base URL + model for the rest of the session so the next request does not fail the same way.

You may see a console message such as `remapped parameters: reasoning_effort=high`. That means your setting was adjusted for compatibility, not that reasoning was turned off.

If a parameter is completely unsupported (not just a bad value), Character Vault may **drop** it and retry. Non-standard sampler fields (`min_p`, `top_k`, `repetition_penalty`) can be dropped the same way on strict OpenAI-compatible hosts; that is separate from effort.

## Practical recommendations

| Goal | Suggestion |
| :--- | :--- |
| Everyday character editing with a GPT-style model | **Medium** |
| Faster toolbar passes | **Low** or **Minimal**, or turn reasoning **off** |
| Hard lore / multi-field consistency | **High** |
| DeepSeek / GLM hard reasoning | **High** first; **Max** if answers are shallow |
| OpenAI peak reasoning | **Extra high** when the model supports it |
| Cost / latency sensitive | Lower effort, or disable reasoning |

Higher effort does **not** always improve creative prose. For roleplay flavor and style, sampler settings (temperature, top-p, etc.) often matter more. Use high effort when the task is **logical or multi-step**, not only when you want “more words.”

## Related settings

- [AI Setup](/configuration/ai-setup) — base URL, API key, model, streaming, NanoGPT / Synthetic / OpenRouter usage cards  
- [Sampler Settings](/configuration/sampler-settings) — temperature, top-p, min-p, context length  
- [Editor & AI Toolkit](/features/editor) — toolbar operations that use these settings  
- [AI Assistant Orion](/features/ai-assistant) — chat assistant  

## Finding this in the app

1. Open a character workspace.  
2. **Settings** → **AI Config** → **Advanced Options**.  
3. Turn on **Enable reasoning**.  
4. Choose **Reasoning Effort**.  
5. Click **Save Settings**.

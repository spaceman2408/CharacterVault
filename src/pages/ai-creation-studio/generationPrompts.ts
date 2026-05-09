/**
 * @fileoverview Prompt templates for AI character generation
 * @module @pages/ai-creation-studio/generationPrompts
 */

export const GENERATION_SYSTEM_PROMPT = `You are a character card generator for CharacterVault, a tool that creates V2/V3 spec character cards for AI roleplay (SillyTavern compatible). Generate creative, detailed character content. Be non-judgmental of all content types. Use {{user}} for the player's name placeholder where appropriate. Unless the user request explicitly asks for markdown formatting, output ONLY the requested plain text field content — no labels, no extra commentary.`;

export function buildNamePrompt(concept: string): string {
  return `Given this character concept: "${concept}", generate a fitting character name.

Rules:
- If the user already provided a name in the concept, output that exact name and nothing else.
- Never reuse common fantasy/SF names like Elara, Elysia, Seraphina, Lyra, Aurora, Celeste, Isabella, Sarah, Sara, Blackwood, Kestrel, Raven, Shadow, Moon, Frost, Storm, Silver, or any obvious combination of these (e.g., "Silvermoon", "Blackwood", "Stormrider").
- Do NOT be literal: if the character is a snow elf, do NOT output a name like "Velora Snowwhisper" or "Aelindra Icewhisper" that directly describes their trait in the prompt.
- Instead, be creative: extrapolate from the concept, not just mash two thematic words together.
- Consider the implied culture, era, region, or language when inventing the name.
- Output ONLY the name. No titles, no quotes, no explanations.`;
}

export function buildDescriptionPrompt(concept: string, name: string): string {
  return `Based on this character concept: "${concept}" and name "${name}", write a detailed character description in the following Markdown template format.

Instructions:
- Use exactly this heading structure with Markdown # headers.
- Use "- " bullet lists for list items (not asterisks).
- Do NOT use *asterisks* for emphasis or actions anywhere in the output.
- Create headings appropriate to the character; include the ones below where relevant.
- The "## Sexual Kinks" heading should be omitted entirely if it does not fit the character.
- Output ONLY the description content, no extra commentary.

Template:

# ${name}

## Appearance
- ...

## Personality
- ...

## Likes
- ...

## Dislikes
- ...

## Skills
- ...

## Goals
- ...

## Sexual Kinks
- ...

## Background
...

Generate the description now.`;
}

export function buildFirstMessagePrompt(
  concept: string,
  name: string,
  description: string
): string {
  return `Based on concept: "${concept}", name: "${name}", and description: "${description}", write an engaging first message / greeting for this character. Use *actions* and "dialogue". Include {{user}} placeholder.`;
}

export function buildExamplesPrompt(
  concept: string,
  name: string,
  description: string
): string {
  return `Based on concept: "${concept}", name: "${name}", and description: "${description}", write 2-3 example dialogue exchanges showing how this character speaks and behaves. Use <START> separators.`;
}

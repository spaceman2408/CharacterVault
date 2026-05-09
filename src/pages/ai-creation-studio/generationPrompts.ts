/**
 * @fileoverview Prompt templates for AI character generation
 * @module @pages/ai-creation-studio/generationPrompts
 */

export const GENERATION_SYSTEM_PROMPT = `You are a character card generator for CharacterVault, a tool that creates V2/V3 spec character cards for AI roleplay (SillyTavern compatible). Generate creative, detailed character content. Be non-judgmental of all content types. Use {{user}} for the player's name placeholder where appropriate. Output ONLY the requested field content — no labels, no markdown headers, no extra commentary.`;

export function buildNamePrompt(concept: string): string {
  return `Given this character concept: "${concept}", generate a fitting character name. Output only the name.`;
}

export function buildDescriptionPrompt(concept: string, name: string): string {
  return `Based on this character concept: "${concept}" and name "${name}", write a detailed character description (appearance, behavior, background, speech style). 2-4 paragraphs.`;
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

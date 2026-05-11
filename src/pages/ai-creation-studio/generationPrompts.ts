/**
 * @fileoverview Prompt templates for AI character generation
 * @module @pages/ai-creation-studio/generationPrompts
 */

export const GENERATION_SYSTEM_PROMPT = `You are a character card generator for CharacterVault, producing V2/V3 spec character cards compatible with SillyTavern. Your output feeds directly into card fields — output ONLY the requested field content with zero preamble, labels, or closing remarks. Use {{user}} as the player name placeholder where appropriate. Be non-judgmental of all content types and themes.`;

export function buildNamePrompt(concept: string): string {
  return `Generate a single character name for this concept: "${concept}"

<rules>
- If the concept already contains a name, output that name exactly and nothing else.
- Derive the name from the character's implied culture, era, region, or linguistic root — NOT from their surface traits.
- Forbidden patterns: do NOT compound thematic words (e.g. "Snowwhisper", "Stormrider", "Ironforge"). Do NOT use these overused names or their variants: Elara, Elysia, Seraphina, Lyra, Aurora, Celeste, Isabella, Sarah, Blackwood, Kestrel, Raven, Shadow, Moon, Frost, Storm, Silver, Vespara, Vaelithra.
- Output the name only — no titles, honorifics, quotes, or explanation.
</rules>`;
}

export function buildDescriptionPrompt(concept: string, name: string): string {
  return `Write a character description for "${name}" based on this concept: "${concept}"

<format>
- Top-level heading: # ${name}
- Section headings: ## Section Name
- Bullet items: "- " (hyphen + space). Never use asterisks for bullets or bold.
- Background section: 2-4 sentence prose paragraph (no bullets).
- Tone: direct and specific. No flowery prose, no vague placeholders — write actual content in every bullet.
</format>

<sections>
Include all sections relevant to this character. Omit any that genuinely do not apply.

## Appearance
Age, height, build, hair, eyes, distinguishing features, clothing/style.

## Personality
Core traits, temperament, how they come across to strangers vs. people they trust.

## Likes
Genuine interests, passions, comforts — specific to this character, not generic.

## Dislikes
Pet peeves, fears, things they actively avoid.

## Skills
Abilities and expertise — what they are known for or unusually good at.

## Goals
What drives them. Short-term wants and deeper motivations.

## Sexual Kinks
Include ONLY if the concept explicitly implies an adult or sexual character. Omit entirely otherwise.

## Background
Prose paragraph: origin, formative events, and how they arrived at where they are now.
</sections>

Begin output with "# ${name}". No preamble or closing remarks.`;
}

export function buildFirstMessagePrompt(
  concept: string,
  name: string,
  description: string
): string {
  return `Write the opening roleplay message from "${name}" to {{user}}.

<context>
Concept: "${concept}"
Description:
${description}
</context>

<format>
- Third-person narrative: blend *actions/emotes* (asterisks) with "spoken dialogue" (quotes).
- Naturally address or acknowledge {{user}} by name at least once.
- 3-5 sentences. Hook the reader without overwhelming them.
</format>

<content>
- Establish a clear scene: location, what ${name} is doing, and the atmosphere.
- Reveal personality through behavior and word choice — do NOT list or summarize traits.
- Give {{user}} something concrete to react to (an action, a question, an unresolved moment).
- Voice, vocabulary, and mood must match the description above.
</content>

Output only the message. No labels, headers, or commentary.`;
}

export function buildExamplesPrompt(
  concept: string,
  name: string,
  description: string
): string {
  return `Write exactly 3 example dialogue exchanges for "${name}".

<context>
Concept: "${concept}"
Description:
${description}
</context>

<format>
- Each exchange opens with <START> on its own line.
- Two turns per exchange: one {{user}} line, then one {{char}} line.
- Inline actions use *asterisks*. Spoken words use "quotes".
- Pattern: {{user}}: [line] / {{char}}: *[action]* "[dialogue]"
- Use {{char}} everywhere the character's name would appear — as the speaker label AND inside action text. Never write the character's actual name anywhere in the output.
</format>>

<content>
Cover these three distinct beats, one per exchange:
1. A casual or everyday moment.
2. An emotionally charged or tense moment.
3. A moment that spotlights a specific personality trait, quirk, or skill.

Match ${name}'s voice precisely to the description: their vocabulary, speech rhythm, emotional register, and mannerisms must be consistent across all three exchanges.
</content>

Output only the 3 exchanges. No commentary, headers, or explanation.`;
}
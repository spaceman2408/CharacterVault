import type { AgentSkill } from './characterTypes';

export const DEFAULT_AGENT_SKILLS: readonly AgentSkill[] = [
  {
    id: 'default-greeting-writer',
    name: 'Greeting Writer',
    description: 'Use when writing or revising first_mes or alternate greetings.',
    content: `Goal: openings that hand {{user}} a scene to step into.

1. read_field description before writing. Do not contradict it.
2. Make each greeting a different situation: vary place, time, mood, and how {{char}} and {{user}} meet. Do not reuse the first_mes setup.
3. Write from {{char}}'s side. Never write {{user}}'s actions, words, thoughts, or feelings.
4. Use the {{char}} and {{user}} macros where the card already does.
5. Keep the card's existing format (asterisk actions, quotes, tense, person). Match first_mes if it has a style.
6. 150 to 400 words unless the user asks otherwise. Open in motion, not with backstory.
7. End on something {{user}} can answer: a question, an offer, a choice, or a moment that needs a reaction.
8. Add new alternates with add_greeting. To revise one, read_greeting, then replace_in_greeting or update_greeting.`,
  },
  {
    id: 'default-lorebook-entries',
    name: 'Lorebook Entries',
    description: 'Use when adding lorebook entries or revising their keys or bodies.',
    content: `1. One topic per entry: a place, person, faction, item, or custom. Split an entry that covers several.
2. Check the catalog for an entry on the same topic first; revise it instead of adding a near-duplicate.
3. Keys: 2 to 5 words a chat would actually say, such as the name, short forms, and plural or possessive forms. Skip common words (the, war, king, magic) that fire on unrelated chat.
4. Body: plain facts in 50 to 200 words. Lead with what it is, then what matters in play. No story prose and no instructions to the AI.
5. Do not repeat {{char}}'s core traits in entries; those belong in description.
6. Name another entry's key words in a body only when the link matters, since that is what drives recursion.
7. After writing, test_keys with a line or two of sample chat to check that the new keys fire and common words do not.`,
  },
  {
    id: 'default-cut-ai-slop',
    name: 'Cut AI Slop',
    description: 'Use when the user asks to clean up, de-slop, or tighten prose in the card or book.',
    content: `Remove stock AI phrasing while keeping meaning, facts, and voice.

Look for:
- Stock body reactions: shivers down a spine, a breath hitching, a smirk playing on lips, eyes sparkling with mischief, a breath they didn't know they were holding.
- Filler: "a mix of", "a testament to", "can't help but", "little did they know", "the air thick with", "barely above a whisper".
- Overused words: tapestry, palpable, unspoken, ministrations, ozone, padded.
- Stacked adjectives and three-item lists used only for rhythm.
- Em dashes used as a habit rather than for a real break.

Rules:
1. search for a phrase before editing; edit only the places that use it.
2. Replace it with a concrete detail that fits the character, or cut it. Do not swap one cliche for another.
3. Fix small spans with replace_in_field, replace_in_greeting, or replace_in_entry. Do not rewrite whole fields unless the user asks.
4. Keep {{char}} and {{user}} macros, dialogue meaning, and formatting intact.
5. Finish with a short list of what you changed and where.`,
  },
];

/**
 * Short help copy for lorebook fields, aligned with SillyTavern World Info docs:
 * https://docs.sillytavern.app/usage/core-concepts/worldinfo/
 */

export const FIELD_HELP = {
  entryTitle:
    'Label for your convenience only. Not sent to the model and not used for triggers. (SillyTavern: Entry Title / Memo.)',

  enabled:
    'When off, this entry never activates in SillyTavern, even if keys match.',

  constant:
    'Always-on entry: needs no keywords and can activate regardless of chat content. (SillyTavern blue-circle / Constant strategy.)',

  primaryKeys:
    'Keywords (or JS-style /regex/) that can activate this entry when found in scanned chat. Not case-sensitive by default. Keys themselves are not inserted into the prompt—only Content is. (SillyTavern: Key.)',

  secondaryKeys:
    'Optional filter keys used with Selective. Ignored when Selective is off or this list is empty. Supports the same matching rules as primary keys. (SillyTavern: Optional Filter.)',

  selective:
    'When on, primary keys must match and secondary keys are checked with the selected logic before the entry can activate.',

  selectiveLogic: {
    0: 'AND ANY — primary key match plus at least one secondary key in scanned context.',
    1: 'NOT ALL — primary key match; blocked only if every secondary key is present.',
    2: 'NOT ANY — primary key match and none of the secondary keys are present.',
    3: 'AND ALL — primary key match and every secondary key is present.',
  } as Record<number, string>,

  insertionOrder:
    'When several entries activate, higher order numbers insert closer to the end of context and usually have more influence on the reply. (SillyTavern: Insertion Order.)',

  position:
    'Where activated content is injected in the prompt: before/after character defs, before/after example messages, or at a chat depth with a message role. (SillyTavern: Insertion Position.)',

  depth:
    'Chat depth for @ Depth insertion. Depth 0 is the bottom of the prompt (closest to the latest messages). (SillyTavern: @ D.)',

  role:
    'Message role used when inserting at depth: system, user, or assistant. (SillyTavern depth role icons.)',

  caseSensitive:
    'When on, keys must match the exact letter case in chat. Useful for short common words. (SillyTavern: Case-sensitive keys; can override book/global default.)',

  matchWholeWords:
    'When on, single-word keys match only full words (e.g. “king” matches “the king” but not “liking”). Prefer off for languages without spaces. (SillyTavern: Match whole words.)',

  probability:
    'Chance the entry is actually inserted after it would activate (keys, constant, or recursion). 100 = always, 50 ≈ half the time, 0 = never. (SillyTavern: Probability / Trigger %.)',

  useProbability:
    'When on, the probability % is applied. When off, activations are not rolled against %.',

  excludeRecursion:
    'Non-recursable: other entries cannot activate this one by mentioning its keys in their content. (SillyTavern: Non-recursable.)',

  preventRecursion:
    'Once this entry activates, it will not trigger further recursive activations of other entries. (SillyTavern: Prevent further recursion.)',

  delayUntilRecursion:
    'Only activates on recursive passes—not from the initial chat scan. Useful for layered lore that should unlock after another entry. (SillyTavern: Delay until recursion.)',

  content:
    'Text inserted into the prompt when the entry activates. Titles and keys are not inserted—put everything the model should see here, written as standalone text. (SillyTavern: Entry Content.)',

  internalNotes:
    'Optional internal notes (Character Vault stores this as the entry name field). Not used as ST’s memo/title and not part of activation.',

  scanDepth:
    'How many recent chat messages are scanned for keys. 0 = only recursion / Author’s Note; 1 = last message only; 2 = last two, etc. (SillyTavern: Scan Depth.)',

  tokenBudget:
    'Max tokens World Info may consume at once. Constants insert first, then higher order numbers. When the budget is full, further matches are skipped. (SillyTavern: Context % / Budget.)',

  recursiveScanning:
    'When on, activated entries can unlock others by naming their keys in Content (and vice versa, subject to per-entry recursion flags). (SillyTavern: Recursive scanning.)',

  aiContext:
    'Character Vault only: which entries Orion and the AI toolbar include as context while you edit. Separate from SillyTavern Enabled/Constant activation.',
} as const;

export const TAVERN_SETTINGS = ['grounded', 'fantasy'] as const;
export type TavernSetting = (typeof TAVERN_SETTINGS)[number];

interface TavernWords {
  /** Coat, mood, and body words: they only make sense on an animal or creature. */
  animalAdjectives: string[];
  anyAdjectives: string[];
  animals: string[];
  things: string[];
  plurals: string[];
  heads: string[];
  arms: string[];
}

const GROUNDED: TavernWords = {
  animalAdjectives: [
    'Bald', 'Barking', 'Bearded', 'Blind', 'Brindled', 'Dun', 'Honest', 'Hooded', 'Hungry', 'Jolly', 'Lame',
    'Leaping', 'Merry', 'Patient', 'Pied', 'Running', 'Sober', 'Speckled', 'Spotted', 'Startled', 'Stubborn',
    'Three-Legged', 'Weary', 'Wounded',
  ],
  anyAdjectives: ['Black', 'Blue', 'Crooked', 'Drowned', 'Green', 'Grey', 'Little', 'Lucky', 'Old', 'Ragged', 'Red', 'Royal', 'White'],
  animals: [
    'Badger', 'Boar', 'Bull', 'Cock', 'Crow', 'Eel', 'Fox', 'Goose', 'Hare', 'Hart', 'Heron', 'Horse', 'Lamb',
    'Mare', 'Otter', 'Owl', 'Ox', 'Pig', 'Pike', 'Ram', 'Stag', 'Swan', 'Trout',
  ],
  things: [
    'Acorn', 'Anchor', 'Anvil', 'Bell', 'Boot', 'Candle', 'Cart', 'Cask', 'Crown', 'Drum', 'Fiddle', 'Glove',
    'Hammer', 'Harp', 'Harrow', 'Hat', 'Kettle', 'Key', 'Ladle', 'Lantern', 'Mill', 'Mitre', 'Oar', 'Pipe',
    'Plough', 'Rose', 'Saddle', 'Ship', 'Sickle', 'Spade', 'Thistle', 'Tun', 'Wagon', 'Wheatsheaf', 'Wheel',
  ],
  plurals: [
    'Bells', 'Chimneys', 'Cranes', 'Crowns', 'Cups', 'Daggers', 'Feathers', 'Hares', 'Horses', 'Horseshoes',
    'Keys', 'Magpies', 'Pigeons', 'Salmon', 'Stars', 'Swans', 'Tuns',
  ],
  heads: ['Abbot', 'Bishop', 'Bull', 'Ferryman', 'King', 'Miller', 'Nag', 'Queen', 'Ram', 'Shepherd', 'Smith'],
  arms: [
    'Bargeman', 'Brewer', 'Carpenter', 'Chandler', 'Collier', 'Cooper', 'Cordwainer', 'Drover', 'Farrier',
    'Fletcher', 'Gardener', 'Mason', 'Ploughman', 'Shipwright', 'Tanner', 'Thatcher', 'Weaver', 'Wheelwright',
  ],
};

const FANTASY_EXTRA: TavernWords = {
  animalAdjectives: ['Headless', 'Hexed', 'One-Eyed', 'Petrified', 'Two-Headed'],
  anyAdjectives: [],
  animals: [
    'Basilisk', 'Cockatrice', 'Griffin', 'Hydra', 'Imp', 'Kraken', 'Manticore', 'Mermaid', 'Ogre', 'Troll',
    'Unicorn', 'Wyvern',
  ],
  things: ['Broomstick', 'Cauldron', 'Scroll'],
  plurals: ['Giants', 'Imps', 'Ravens', 'Runes', 'Witches'],
  heads: ['Giant', 'Hermit', 'Knight', 'Troll', 'Warlock', 'Witch'],
  arms: ['Alchemist', 'Mapmaker', 'Scribe'],
};

const NUMBERS = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Nine', 'Twelve'];

export const OVERUSED_TAVERNS: ReadonlySet<string> = new Set([
  'the broken barrel',
  'the crimson chalice',
  'the drunken dragon',
  'the gilded tankard',
  'the golden goblet',
  'the green dragon',
  'the laughing goblin',
  'the leaky cauldron',
  'the prancing pony',
  'the rusty anchor',
  'the rusty nail',
  'the salty dog',
  'the silver stag',
  'the sleeping dragon',
  'the wandering minstrel',
]);

const FANTASY_ONLY = new Set(Object.values(FANTASY_EXTRA).flat());

export function isFantasyTavernWord(word: string): boolean {
  return FANTASY_ONLY.has(word);
}

function pickFrom(items: readonly string[]): string {
  return items[Math.floor(Math.random() * items.length)];
}

// Fantasy picks the fantasy word half the time, so most names get one creature or trade without losing the pub feel.
function picker(setting: TavernSetting): (slot: keyof TavernWords) => string {
  return (slot) => {
    const extra = FANTASY_EXTRA[slot];
    return setting === 'fantasy' && extra.length > 0 && Math.random() < 0.5 ? pickFrom(extra) : pickFrom(GROUNDED[slot]);
  };
}

/** One English inn or tavern name in a real-pub pattern. */
export function inventTavern(setting: TavernSetting): string {
  const pick = picker(setting);
  const noun = () => pick(Math.random() < 0.5 ? 'animals' : 'things');
  const roll = Math.random();
  if (roll < 0.2) return `The ${pick(Math.random() < 0.6 ? 'animalAdjectives' : 'anyAdjectives')} ${pick('animals')}`;
  if (roll < 0.35) return `The ${pick('anyAdjectives')} ${pick('things')}`;
  if (roll < 0.55) {
    const first = noun();
    let second = noun();
    while (second === first) second = noun();
    return `The ${first} and ${second}`;
  }
  if (roll < 0.65) return `The ${pick('heads')}'s Head`;
  if (roll < 0.75) return `The ${pick('arms')}'s Arms`;
  if (roll < 0.9) return `The ${pickFrom(NUMBERS)} ${pick('plurals')}`;
  return `The ${noun()}`;
}

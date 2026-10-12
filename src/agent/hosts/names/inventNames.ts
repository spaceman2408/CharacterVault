const START = '\u0002';
const END = '\u0003';
const MIN_LENGTH = 3;
const LARGE_TRAINING_SET = 200;
const COMPOUND_PREFIX_MIN = 4;
const COMPOUND_TAIL_MIN = 3;

export interface NameModel {
  order: number;
  transitions: Map<string, Map<string, number>>;
  minLength: number;
  maxLength: number;
  training: string[];
}

function percentileLength(names: string[], fraction: number): number {
  const lengths = names.map((name) => [...name].length).sort((a, b) => a - b);
  return lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * fraction))] ?? 0;
}

/** Character chain over the given lists. Each list weighs the same, so a small origin is not drowned out when blended. */
export function buildNameModel(lists: string[][]): NameModel | null {
  const nonEmpty = lists.filter((list) => list.length > 0);
  if (nonEmpty.length === 0) return null;
  const training = [...new Set(nonEmpty.flat().map((name) => name.toLowerCase()))];
  // Order 3 on a small list mostly copies real names; order 2 invents more there.
  const order = training.length >= LARGE_TRAINING_SET ? 3 : 2;
  const largest = Math.max(...nonEmpty.map((list) => list.length));
  const transitions = new Map<string, Map<string, number>>();
  for (const list of nonEmpty) {
    const weight = largest / list.length;
    for (const name of list) {
      const chars = [...START.repeat(order), ...name.toLowerCase(), END];
      for (let i = order; i < chars.length; i += 1) {
        const context = chars.slice(i - order, i).join('');
        const next = transitions.get(context) ?? new Map<string, number>();
        next.set(chars[i], (next.get(chars[i]) ?? 0) + weight);
        transitions.set(context, next);
      }
    }
  }
  return {
    order,
    transitions,
    minLength: Math.max(MIN_LENGTH, percentileLength(training, 0.1)),
    // Long outputs are mostly two real names run together.
    maxLength: percentileLength(training, 0.75) + 1,
    training: training.filter((name) => [...name].length >= COMPOUND_PREFIX_MIN),
  };
}

function sample(options: Map<string, number>): string {
  let total = 0;
  for (const weight of options.values()) total += weight;
  let roll = Math.random() * total;
  for (const [char, weight] of options) {
    roll -= weight;
    if (roll < 0) return char;
  }
  return END;
}

function isCompound(name: string, training: readonly string[]): boolean {
  return training.some(
    (real) => name.length - real.length >= COMPOUND_TAIL_MIN && name.startsWith(real),
  );
}

/** One invented name, or undefined when this draw is too short, too long, real, or a real name plus a tail. */
export function inventName(model: NameModel, realNames: ReadonlySet<string>): string | undefined {
  let context = [...START.repeat(model.order)];
  const chars: string[] = [];
  for (;;) {
    const next = model.transitions.get(context.join(''));
    const char = next ? sample(next) : END;
    if (char === END) break;
    chars.push(char);
    if (chars.length > model.maxLength) return undefined;
    context = [...context.slice(1), char];
  }
  if (chars.length < model.minLength) return undefined;
  const name = chars.join('');
  if (realNames.has(name) || isCompound(name, model.training)) return undefined;
  return name.replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

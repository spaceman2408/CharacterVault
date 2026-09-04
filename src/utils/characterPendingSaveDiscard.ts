type DiscardFn = (characterId: string) => void;

const discards = new Set<DiscardFn>();

/** Editor provider registers so delete paths can drop debounced saves for a removed card. */
export function registerPendingSaveDiscard(fn: DiscardFn): () => void {
  discards.add(fn);
  return () => {
    discards.delete(fn);
  };
}

/** Drop queued (not yet committed) editor saves for a character. Safe when none are pending. */
export function discardPendingSavesForCharacter(characterId: string): void {
  for (const fn of [...discards]) {
    fn(characterId);
  }
}

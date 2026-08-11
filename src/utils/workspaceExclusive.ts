/**
 * Mutual exclusion for full open workspaces (character card vs vault lorebook).
 * Providers register a payload drop; open/create paths call the other side so
 * only one large in-memory document is retained.
 */

type DropFn = () => void;

let dropCharacterPayload: DropFn | null = null;
let dropLorebookPayload: DropFn | null = null;

/** Register how to clear the open character card from React state. */
export function registerCharacterPayloadDrop(fn: DropFn): () => void {
  dropCharacterPayload = fn;
  return () => {
    if (dropCharacterPayload === fn) dropCharacterPayload = null;
  };
}

/** Register how to clear the open vault lorebook from React state. */
export function registerLorebookPayloadDrop(fn: DropFn): () => void {
  dropLorebookPayload = fn;
  return () => {
    if (dropLorebookPayload === fn) dropLorebookPayload = null;
  };
}

/** Drop full character payload (id + card). Safe to call when none is open. */
export function dropOpenCharacterPayload(): void {
  dropCharacterPayload?.();
}

/** Drop full lorebook payload (id + book). Safe to call when none is open. */
export function dropOpenLorebookPayload(): void {
  dropLorebookPayload?.();
}

/**
 * True while an IME (Japanese, Chinese, Korean, ...) is composing text, when
 * Enter confirms a word and Escape cancels it. Key handlers should ignore the
 * key then. Safari reports the confirming Enter with `isComposing` false and
 * `keyCode` 229.
 */
export function isImeComposing(event: KeyboardEvent | { nativeEvent: KeyboardEvent }): boolean {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  return native.isComposing || native.keyCode === 229;
}

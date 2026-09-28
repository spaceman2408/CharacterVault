const FINISHED_PREFIX = 'Agent finished · ';

// A window behind another app stays "visible", so focus counts too.
function isAway(doc: Document): boolean {
  return doc.hidden || !doc.hasFocus();
}

/** Marks the tab title when a run ends while the user is away; restores it on return. */
export function noteRunFinished(doc: Document = document, win: Window = window): void {
  if (!isAway(doc) || doc.title.startsWith(FINISHED_PREFIX)) return;
  const original = doc.title;
  const marked = `${FINISHED_PREFIX}${original}`;
  doc.title = marked;
  const restore = () => {
    if (isAway(doc)) return;
    doc.removeEventListener('visibilitychange', restore);
    win.removeEventListener('focus', restore);
    if (doc.title === marked) doc.title = original;
  };
  doc.addEventListener('visibilitychange', restore);
  win.addEventListener('focus', restore);
}

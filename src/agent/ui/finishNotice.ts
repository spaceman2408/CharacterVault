const FINISHED_PREFIX = 'Agent finished · ';

/** Marks the tab title when a run ends while the page is hidden; restores it on return. */
export function noteRunFinished(doc: Document = document): void {
  if (!doc.hidden || doc.title.startsWith(FINISHED_PREFIX)) return;
  const original = doc.title;
  const marked = `${FINISHED_PREFIX}${original}`;
  doc.title = marked;
  const restore = () => {
    if (doc.hidden) return;
    doc.removeEventListener('visibilitychange', restore);
    if (doc.title === marked) doc.title = original;
  };
  doc.addEventListener('visibilitychange', restore);
}

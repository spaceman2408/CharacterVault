import { describe, expect, it } from 'vitest';
import { noteRunFinished } from '../../../src/agent/ui/finishNotice';

class FakeDocument extends EventTarget {
  hidden = true;
  title = 'Character Vault';

  show() {
    this.hidden = false;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function fake(hidden = true) {
  const doc = new FakeDocument();
  doc.hidden = hidden;
  return { doc, asDocument: doc as unknown as Document };
}

describe('noteRunFinished', () => {
  it('marks the title while hidden and restores it on return', () => {
    const { doc, asDocument } = fake();
    noteRunFinished(asDocument);
    expect(doc.title).toBe('Agent finished · Character Vault');
    doc.show();
    expect(doc.title).toBe('Character Vault');
  });

  it('leaves the title alone when the page is visible', () => {
    const { doc, asDocument } = fake(false);
    noteRunFinished(asDocument);
    expect(doc.title).toBe('Character Vault');
  });

  it('does not stack the mark for a second run', () => {
    const { doc, asDocument } = fake();
    noteRunFinished(asDocument);
    noteRunFinished(asDocument);
    expect(doc.title).toBe('Agent finished · Character Vault');
    doc.show();
    expect(doc.title).toBe('Character Vault');
  });

  it('keeps a title someone else set meanwhile', () => {
    const { doc, asDocument } = fake();
    noteRunFinished(asDocument);
    doc.title = 'Other';
    doc.show();
    expect(doc.title).toBe('Other');
  });
});

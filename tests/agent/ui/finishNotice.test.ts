import { describe, expect, it } from 'vitest';
import { noteRunFinished } from '../../../src/agent/ui/finishNotice';

class FakeDocument extends EventTarget {
  hidden = false;
  focused = true;
  title = 'Character Vault';

  hasFocus() {
    return this.focused;
  }
}

function setup({ hidden = false, focused = true } = {}) {
  const doc = new FakeDocument();
  doc.hidden = hidden;
  doc.focused = focused;
  const win = new EventTarget();
  const note = () => noteRunFinished(doc as unknown as Document, win as unknown as Window);
  const show = () => {
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
  };
  const focus = () => {
    doc.focused = true;
    win.dispatchEvent(new Event('focus'));
  };
  return { doc, note, show, focus };
}

describe('noteRunFinished', () => {
  it('marks the title while the tab is hidden and restores it on return', () => {
    const { doc, note, show } = setup({ hidden: true });
    note();
    expect(doc.title).toBe('Agent finished · Character Vault');
    show();
    expect(doc.title).toBe('Character Vault');
  });

  it('marks the title while the window is unfocused and restores it on focus', () => {
    const { doc, note, focus } = setup({ focused: false });
    note();
    expect(doc.title).toBe('Agent finished · Character Vault');
    focus();
    expect(doc.title).toBe('Character Vault');
  });

  it('waits until the page is both visible and focused', () => {
    const { doc, note, show, focus } = setup({ hidden: true, focused: false });
    note();
    show();
    expect(doc.title).toBe('Agent finished · Character Vault');
    focus();
    expect(doc.title).toBe('Character Vault');
  });

  it('leaves the title alone when the user is on the page', () => {
    const { doc, note } = setup();
    note();
    expect(doc.title).toBe('Character Vault');
  });

  it('does not stack the mark for a second run', () => {
    const { doc, note, focus } = setup({ focused: false });
    note();
    note();
    expect(doc.title).toBe('Agent finished · Character Vault');
    focus();
    expect(doc.title).toBe('Character Vault');
  });

  it('keeps a title someone else set meanwhile', () => {
    const { doc, note, focus } = setup({ focused: false });
    note();
    doc.title = 'Other';
    focus();
    expect(doc.title).toBe('Other');
  });
});

import React from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { CREATOR_NOTES_SNIPPETS, type CreatorNotesSnippet } from './creatorNotesSnippets';

interface CreatorNotesSnippetMenuProps {
  onInsert: (snippet: CreatorNotesSnippet) => void;
}

export function CreatorNotesSnippetMenu({ onInsert }: CreatorNotesSnippetMenuProps): React.ReactElement {
  const [position, setPosition] = React.useState<{ top: number; right: number } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const open = position !== null;

  React.useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', close);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    if (open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Insert
      </button>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Insert a snippet"
            onKeyDown={handleMenuKeyDown}
            className="fixed z-9999 w-52 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl"
            style={{ top: position.top, right: position.right }}
          >
            {CREATOR_NOTES_SNIPPETS.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPosition(null);
                  onInsert(snippet);
                }}
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
              >
                {snippet.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default CreatorNotesSnippetMenu;

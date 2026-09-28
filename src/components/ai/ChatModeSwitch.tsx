import { Bot, MessageSquare } from 'lucide-react';

export type ChatMode = 'orion' | 'agent';

const MODES: Array<{ id: ChatMode; label: string; hint: string; Icon: typeof Bot }> = [
  { id: 'orion', label: 'Orion', hint: 'Orion · chat only, does not write', Icon: MessageSquare },
  { id: 'agent', label: 'Agent', hint: 'Agent · writes the open card or book', Icon: Bot },
];

/** Icon switch between Orion and the Agent for the chat header; the active mode is highlighted. */
export function ChatModeSwitch({
  mode,
  onChange,
}: {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}): React.ReactElement {
  return (
    <div
      role="group"
      aria-label="Chat mode"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5"
    >
      {MODES.map(({ id, label, hint, Icon }) => {
        const active = id === mode;
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (!active) onChange(id);
            }}
            aria-pressed={active}
            aria-label={label}
            title={hint}
            className={`rounded-md p-1 transition-colors ${
              active ? 'bg-accent-soft text-accent' : 'text-fg-subtle hover:bg-hover hover:text-fg'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

import React, { useState } from 'react';
import { AlertCircle, Check, Plus } from 'lucide-react';

export interface PromptVariable {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

function promptVariableToken(key: string): string {
  return `\${${key}}`;
}

export const PromptVariableChips: React.FC<{
  variables: PromptVariable[];
  value: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}> = ({ variables, value, textareaRef, onChange }) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (variables.length === 0) return null;

  const select = (start: number, end: number) => {
    const el = textareaRef.current;
    if (!el) return;
    // Browsers don't scroll a textarea to a programmatic selection, so measure the text
    // height up to it and scroll there. The value is restored before React can notice.
    const full = el.value;
    el.value = full.slice(0, start);
    const caretTop = el.scrollHeight;
    el.value = full;
    el.focus();
    el.setSelectionRange(start, end);
    el.scrollTop = caretTop <= el.clientHeight ? 0 : caretTop - el.clientHeight / 2;
  };

  const findExisting = (key: string) => {
    const token = promptVariableToken(key);
    const el = textareaRef.current;
    const from = el && document.activeElement === el ? el.selectionEnd : 0;
    const next = value.indexOf(token, from);
    const start = next === -1 ? value.indexOf(token) : next;
    select(start, start + token.length);
  };

  const insert = (key: string) => {
    const token = promptVariableToken(key);
    const el = textareaRef.current;
    // A chip click keeps focus in the textarea (mousedown is prevented), so an unfocused
    // textarea means the user never placed a cursor; append instead of inserting at 0.
    const focused = !!el && document.activeElement === el;
    const start = focused ? el.selectionStart : value.length;
    const end = focused ? el.selectionEnd : value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const isEmpty = !value.trim();
  const missing = isEmpty ? [] : variables.filter((v) => v.required && !value.includes(promptVariableToken(v.key)));

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => {
          const present = value.includes(promptVariableToken(v.key));
          const isMissing = !isEmpty && v.required && !present;
          const Icon = isMissing ? AlertCircle : present ? Check : Plus;
          const tone = isMissing
            ? 'border-danger/40 bg-danger-soft text-danger-soft-fg'
            : present
              ? 'border-success/30 bg-success-soft text-success-soft-fg'
              : 'border-border-strong bg-surface text-fg-muted hover:text-accent hover:border-accent/40';
          return (
            <button
              key={v.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => (present ? findExisting(v.key) : insert(v.key))}
              onMouseEnter={() => setActiveKey(v.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(v.key)}
              onBlur={() => setActiveKey(null)}
              title={
                present
                  ? `${v.description} Already in the prompt; click to find it.`
                  : `${v.description} Click to insert ${promptVariableToken(v.key)} at the cursor.`
              }
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-colors ${tone}`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              {v.label}
              {v.required && <span className="sr-only">(required)</span>}
            </button>
          );
        })}
      </div>
      {/* Every message shares one grid cell so the line keeps the tallest one's height while hovering. */}
      <div className="mt-1.5 grid text-xs text-fg-muted">
        <p className={`col-start-1 row-start-1 ${activeKey ? 'invisible' : ''}`} aria-hidden={!!activeKey}>
          Click a variable to insert it at the cursor, or to find it if the prompt already uses it.
        </p>
        {variables.map((v) => (
          <p
            key={v.key}
            className={`col-start-1 row-start-1 ${v.key === activeKey ? '' : 'invisible'}`}
            aria-hidden={v.key !== activeKey}
          >
            <span className="font-semibold text-fg">{v.label}</span>
            {v.required ? ' (required)' : ' (optional)'}: {v.description}
          </p>
        ))}
      </div>
      {missing.map((v) => (
        <p key={v.key} className="mt-1 text-xs text-danger flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          Missing {v.label}. Click its chip to add it.
        </p>
      ))}
    </div>
  );
};

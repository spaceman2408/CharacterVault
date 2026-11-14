import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, RotateCcw, ScrollText, Trash2 } from 'lucide-react';
import type { AgentSkill } from '../../../db/characterTypes';
import { DEFAULT_AGENT_SKILLS } from '../../../db/characterTypes';
import {
  createAgentSkillId,
  findDefaultAgentSkill,
  isEditedDefaultSkill,
} from '../../../services/agentSkills';
import { estimateTokens } from '../../../services/AIService';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SettingsCard } from '../components/SettingsCard';
import type { SettingsTabProps } from '../types';

const INPUT_CLASS =
  'w-full px-3 py-2 border border-border-strong rounded-lg bg-surface text-fg text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50';

const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wider text-fg-subtle';

function skillLabel(skill: AgentSkill): string {
  return skill.name.trim() || 'Untitled skill';
}

function SkillSwitch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? 'On: the Agent can use this skill' : 'Off: hidden from the Agent and the @ list'}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-border-strong'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${
          on ? 'translate-x-4' : ''
        }`}
      />
    </button>
  );
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

function GrowingTextarea({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = scrollParent(el);
    const fit = () => {
      const top = scroller?.scrollTop;
      el.style.height = 'auto';
      // Growing can add the panel's scrollbar, which narrows the box and wraps more lines.
      for (let pass = 0; pass < 3 && el.offsetHeight !== el.scrollHeight + 2; pass++) {
        el.style.height = `${el.scrollHeight + 2}px`;
      }
      if (scroller && top != null) scroller.scrollTop = top;
    };
    fit();
    let width = el.clientWidth;
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (el.clientWidth === width) return;
            width = el.clientWidth;
            fit();
          })
        : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`${INPUT_CLASS} resize-none overflow-hidden leading-relaxed`}
    />
  );
}

export const SkillsTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingResetId, setPendingResetId] = useState<string | null>(null);
  const skills = draft.agentSkills;

  /** Switches the open editor, dropping the one being left if nothing was typed into it. */
  const openSkill = (id: string | null) => {
    const leaving = openId;
    if (leaving && leaving !== id) {
      setDraft((prev) => ({
        ...prev,
        agentSkills: prev.agentSkills.filter(
          (skill) =>
            skill.id !== leaving || !!(skill.name.trim() || skill.description.trim() || skill.content.trim()),
        ),
      }));
    }
    setOpenId(id);
  };

  const patchSkill = (id: string, patch: Partial<AgentSkill>) => {
    setDraft((prev) => ({
      ...prev,
      agentSkills: prev.agentSkills.map((skill) => (skill.id === id ? { ...skill, ...patch } : skill)),
    }));
  };

  const toggleSkill = (skill: AgentSkill) => {
    setDraft((prev) => ({
      ...prev,
      agentSkills: prev.agentSkills.map((item) => {
        if (item.id !== skill.id) return item;
        if (item.enabled !== false) return { ...item, enabled: false };
        const next = { ...item };
        delete next.enabled;
        return next;
      }),
    }));
  };

  const addSkill = () => {
    const id = createAgentSkillId();
    setDraft((prev) => ({
      ...prev,
      agentSkills: [{ id, name: '', description: '', content: '' }, ...prev.agentSkills],
    }));
    openSkill(id);
  };

  const deleteSkill = (id: string) => {
    setDraft((prev) => ({ ...prev, agentSkills: prev.agentSkills.filter((skill) => skill.id !== id) }));
    if (openId === id) setOpenId(null);
  };

  const resetSkill = (id: string) => {
    const builtin = findDefaultAgentSkill(id);
    if (!builtin) return;
    patchSkill(id, { name: builtin.name, description: builtin.description, content: builtin.content });
  };

  const takenNames = new Set(skills.map((skill) => skill.name.trim().toLowerCase()));
  const missingDefaults = DEFAULT_AGENT_SKILLS.filter(
    (builtin) =>
      !skills.some((skill) => skill.id === builtin.id) && !takenNames.has(builtin.name.toLowerCase()),
  );

  const restoreDefaults = () => {
    setDraft((prev) => ({
      ...prev,
      agentSkills: [...prev.agentSkills, ...missingDefaults.map((skill) => ({ ...skill }))],
    }));
  };

  const pendingDelete = skills.find((skill) => skill.id === pendingDeleteId);
  const pendingReset = skills.find((skill) => skill.id === pendingResetId);

  return (
    <div className="space-y-4">
      <SettingsCard>
        <div className="mb-1 flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-fg-muted" aria-hidden />
          <h3 className="flex-1 text-sm font-semibold text-fg">Agent skills</h3>
          <button
            type="button"
            onClick={addSkill}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </button>
        </div>
        <p className="mb-4 text-xs text-fg-muted">
          The Agent loads a skill when your request matches its &quot;when to use&quot; line. Type @
          and a skill name in the Agent chat to use one directly.
        </p>

        {skills.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-fg-muted">
            No skills. Add one to give the Agent instructions for a kind of task.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {skills.map((skill) => {
              const on = skill.enabled !== false;
              const isOpen = openId === skill.id;
              const tokens = estimateTokens(skill.content);
              const builtin = findDefaultAgentSkill(skill.id);
              const edited = isEditedDefaultSkill(skill);
              const toggleOpen = () => openSkill(isOpen ? null : skill.id);

              if (!isOpen) {
                return (
                  <li key={skill.id} className="flex items-center gap-3 px-3 py-2.5">
                    <SkillSwitch on={on} label={`Use ${skillLabel(skill)}`} onToggle={() => toggleSkill(skill)} />
                    <button
                      type="button"
                      onClick={toggleOpen}
                      aria-expanded={false}
                      className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-medium group-hover:text-fg ${
                            on ? 'text-fg' : 'text-fg-muted'
                          }`}
                        >
                          {skillLabel(skill)}
                        </span>
                        <span className="block truncate text-xs text-fg-subtle">
                          {on ? skill.description.trim() || 'No "when to use" line' : 'Off · hidden from the Agent and @'}
                        </span>
                      </span>
                      {tokens > 0 && (
                        <span className="shrink-0 text-[11px] text-fg-subtle">~{tokens} tok</span>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
                    </button>
                  </li>
                );
              }

              return (
                <li key={skill.id} className="bg-muted/40">
                  <div className="flex items-center gap-3 px-3 pt-2.5 pb-2">
                    <SkillSwitch on={on} label={`Use ${skillLabel(skill)}`} onToggle={() => toggleSkill(skill)} />
                    <input
                      value={skill.name}
                      onChange={(e) => patchSkill(skill.id, { name: e.target.value })}
                      maxLength={60}
                      placeholder="Skill name"
                      aria-label="Skill name"
                      autoFocus={!skill.name}
                      className={`${INPUT_CLASS} py-1.5 font-medium`}
                    />
                    <button
                      type="button"
                      onClick={toggleOpen}
                      aria-expanded
                      aria-label="Close skill"
                      title="Close"
                      className="shrink-0 rounded-md p-1 text-fg-subtle hover:bg-hover hover:text-fg"
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="space-y-3 px-3 pb-3">
                    <label className="flex flex-col gap-1">
                      <span className={LABEL_CLASS}>When to use</span>
                      <input
                        value={skill.description}
                        onChange={(e) => patchSkill(skill.id, { description: e.target.value })}
                        maxLength={200}
                        placeholder="Use when writing or revising greetings."
                        className={INPUT_CLASS}
                      />
                    </label>
                    <div className="flex flex-col gap-1">
                      <span className={LABEL_CLASS}>
                        Instructions{tokens > 0 ? ` · ~${tokens} tokens when loaded` : ''}
                      </span>
                      <GrowingTextarea
                        value={skill.content}
                        onChange={(content) => patchSkill(skill.id, { content })}
                        placeholder="Steps, rules, and examples the Agent should follow for this task."
                        ariaLabel="Instructions"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1 text-xs text-fg-subtle">
                        {builtin ? (edited ? 'Default skill · edited' : 'Default skill') : ''}
                      </span>
                      {edited && (
                        <button
                          type="button"
                          onClick={() => setPendingResetId(skill.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          Reset to default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(skill.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {missingDefaults.length > 0 && (
          <button
            type="button"
            onClick={restoreDefaults}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Add back {missingDefaults.length === 1 ? '1 default skill' : `${missingDefaults.length} default skills`}
          </button>
        )}
      </SettingsCard>

      {pendingDelete && (
        <ConfirmDialog
          open
          title={`Delete "${skillLabel(pendingDelete)}"?`}
          message={
            findDefaultAgentSkill(pendingDelete.id)
              ? 'You can add the default skills back from this tab. To keep it but stop the Agent using it, turn it off instead.'
              : 'The skill and its instructions will be removed. This cannot be undone. To keep it but stop the Agent using it, turn it off instead.'
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            deleteSkill(pendingDelete.id);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {pendingReset && (
        <ConfirmDialog
          open
          title={`Reset "${skillLabel(pendingReset)}" to default?`}
          message="Your changes to its name, when-to-use line, and instructions will be replaced with the default text."
          confirmLabel="Reset"
          variant="danger"
          onConfirm={() => {
            resetSkill(pendingReset.id);
            setPendingResetId(null);
          }}
          onCancel={() => setPendingResetId(null)}
        />
      )}
    </div>
  );
};

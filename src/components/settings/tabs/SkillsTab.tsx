import React, { useState } from 'react';
import { Plus, RotateCcw, ScrollText, Trash2 } from 'lucide-react';
import type { AgentSkill } from '../../../db/characterTypes';
import { DEFAULT_AGENT_SKILLS } from '../../../db/characterTypes';
import { createAgentSkillId } from '../../../services/agentSkills';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SettingsCard } from '../components/SettingsCard';
import type { SettingsTabProps } from '../types';

const INPUT_CLASS =
  'px-3 py-2 border border-border-strong rounded-lg bg-surface text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50';

const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wider text-fg-subtle';

export const SkillsTab: React.FC<SettingsTabProps> = ({ draft, setDraft }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const skills = draft.agentSkills;

  const patchSkill = (id: string, patch: Partial<AgentSkill>) => {
    setDraft((prev) => ({
      ...prev,
      agentSkills: prev.agentSkills.map((skill) => (skill.id === id ? { ...skill, ...patch } : skill)),
    }));
  };

  const addSkill = () => {
    const id = createAgentSkillId();
    setDraft((prev) => ({
      ...prev,
      agentSkills: [...prev.agentSkills, { id, name: '', description: '', content: '' }],
    }));
    setExpanded((prev) => ({ ...prev, [id]: true }));
  };

  const deleteSkill = (id: string) => {
    setDraft((prev) => ({ ...prev, agentSkills: prev.agentSkills.filter((skill) => skill.id !== id) }));
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

  const pending = skills.find((skill) => skill.id === pendingDeleteId);

  return (
    <div className="space-y-4">
      <SettingsCard title="Agent skills" icon={<ScrollText className="w-4 h-4" />}>
        <p className="text-sm text-fg-muted mb-4">
          Skills are instructions the Agent loads only when a task needs them. It always sees each
          skill&apos;s name and &quot;when to use&quot; line, and reads the full instructions with
          read_skill when your request matches. Type @ and the skill name in the Agent chat to make
          it use one.
        </p>

        {skills.length === 0 && (
          <p className="text-sm text-fg-muted mb-3">No skills. The Agent works without them.</p>
        )}

        {skills.map((skill) => {
          const isOpen = !!expanded[skill.id];
          const toggle = () => setExpanded((prev) => ({ ...prev, [skill.id]: !prev[skill.id] }));
          return (
            <div
              key={skill.id}
              className={`border rounded-lg mb-2 last:mb-0 transition-colors ${
                isOpen ? 'border-accent/60' : 'border-border'
              }`}
            >
              <div className="w-full min-h-12 flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted rounded-t-lg">
                <button
                  type="button"
                  onClick={toggle}
                  className="flex-1 min-w-0 text-left"
                  title={isOpen ? 'Finish editing' : 'Edit skill'}
                >
                  <span className="block truncate text-sm font-semibold text-fg-muted hover:text-fg">
                    {skill.name.trim() || 'Untitled skill'}
                  </span>
                  {!isOpen && skill.description.trim() && (
                    <span className="block truncate text-xs text-fg-subtle">{skill.description}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  {isOpen ? 'Done' : 'Edit'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(skill.id)}
                  title="Delete skill"
                  className="p-1.5 rounded-md text-fg-muted hover:bg-hover hover:text-danger"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {isOpen && (
                <div className="p-3 sm:p-4 space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className={LABEL_CLASS}>Name</span>
                    <input
                      value={skill.name}
                      onChange={(e) => patchSkill(skill.id, { name: e.target.value })}
                      maxLength={60}
                      placeholder="Greeting Writer"
                      className={INPUT_CLASS}
                    />
                  </label>
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
                  <label className="flex flex-col gap-1">
                    <span className={LABEL_CLASS}>Instructions</span>
                    <textarea
                      value={skill.content}
                      onChange={(e) => patchSkill(skill.id, { content: e.target.value })}
                      rows={10}
                      placeholder="Steps, rules, and examples the Agent should follow for this task."
                      className={`${INPUT_CLASS} w-full resize-y font-mono text-xs leading-relaxed`}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={addSkill}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New skill
          </button>
          {missingDefaults.length > 0 && (
            <button
              type="button"
              onClick={restoreDefaults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg-muted hover:bg-hover hover:text-fg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Add back default skills ({missingDefaults.length})
            </button>
          )}
        </div>
      </SettingsCard>

      {pending && (
        <ConfirmDialog
          open
          title={`Delete "${pending.name.trim() || 'Untitled skill'}"?`}
          message={
            DEFAULT_AGENT_SKILLS.some((skill) => skill.id === pending.id)
              ? 'You can add the default skills back from this tab.'
              : 'The skill and its instructions will be removed. This cannot be undone.'
          }
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            deleteSkill(pending.id);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
};

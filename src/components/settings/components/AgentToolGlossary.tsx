import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Wrench } from 'lucide-react';
import { AGENT_TOOL_REFERENCE, type AgentKind, type AgentToolInfo } from '../../../agent';
import { SettingsCard } from './SettingsCard';

const ONLY_LABEL: Record<AgentKind, string> = { card: 'Card only', lorebook: 'Lorebook only' };

function OnlyBadge({ agent }: { agent: AgentKind }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-fg-subtle">
      {ONLY_LABEL[agent]}
    </span>
  );
}

function soleAgent(tools: readonly AgentToolInfo[]): AgentKind | null {
  const [first] = tools[0]?.agents ?? [];
  return first && tools.every((tool) => tool.agents.length === 1 && tool.agents[0] === first) ? first : null;
}

function ToolRow({
  tool,
  showAgent,
  copied,
  onCopy,
}: {
  tool: AgentToolInfo;
  showAgent: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const Icon = copied ? Check : Copy;
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="shrink-0 sm:w-48">
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${tool.name}`}
          className="group inline-flex max-w-full items-center gap-1.5 break-all text-left font-mono text-xs text-fg hover:text-accent"
        >
          {tool.name}
          <Icon
            className={`h-3 w-3 shrink-0 ${copied ? 'text-success' : 'text-fg-subtle opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
            aria-hidden
          />
        </button>
      </dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-fg-muted">
        {tool.summary}
        {showAgent && tool.agents.length === 1 && <OnlyBadge agent={tool.agents[0]} />}
      </dd>
    </div>
  );
}

export function AgentToolGlossary() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
    } catch {
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setCopied(name);
    timer.current = setTimeout(() => setCopied(null), 1500);
  };

  return (
    <SettingsCard>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <Wrench className="h-4 w-4 text-fg-muted" aria-hidden />
        <span className="flex-1 text-sm font-semibold text-fg">Agent tools</span>
        <ChevronDown
          className={`h-4 w-4 text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="mt-2 space-y-4">
          <p className="text-xs text-fg-muted">
            Name a tool in a skill&apos;s instructions to tell the Agent to use it.
          </p>
          {AGENT_TOOL_REFERENCE.map((group) => {
            const sole = soleAgent(group.tools);
            return (
              <section key={group.label} aria-label={group.label}>
                <h4 className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                  {group.label}
                  {sole && <OnlyBadge agent={sole} />}
                </h4>
                <dl className="divide-y divide-border rounded-lg border border-border">
                  {group.tools.map((tool) => (
                    <ToolRow
                      key={tool.name}
                      tool={tool}
                      showAgent={!sole}
                      copied={copied === tool.name}
                      onCopy={() => void copy(tool.name)}
                    />
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}

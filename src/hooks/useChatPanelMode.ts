import { useCallback, useState } from 'react';
import type { DefaultChatPanel } from '../db/characterTypes';

export function useChatPanelMode(
  defaultChatPanel: DefaultChatPanel,
  resetKey: string | null,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [override, setOverride] = useState<{ key: string | null; agent: boolean } | null>(null);
  const defaultAgent = defaultChatPanel === 'agent';
  const agentMode = override && override.key === resetKey ? override.agent : defaultAgent;

  const setAgentMode = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOverride((prev) => {
        const current = prev && prev.key === resetKey ? prev.agent : defaultAgent;
        const agent = typeof next === 'function' ? next(current) : next;
        return { key: resetKey, agent };
      });
    },
    [defaultAgent, resetKey],
  );

  return [agentMode, setAgentMode];
}

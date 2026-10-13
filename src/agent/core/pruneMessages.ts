import type { AgentMessage } from './types';

/** Prefix runLoop uses for XML-mode tool-result blobs. */
export const TOOL_RESULTS_PREFIX = 'Tool results:\n';

/** Absolute ceiling for one retained tool-result body (tokens). */
export const DEFAULT_MAX_HOG_TOKENS = 32000;
/** One older message may keep at most this share of the total budget. */
export const DEFAULT_HOG_FRACTION = 0.5;
/** Floor kept when trim-to-fit cuts into the newest exchange (tokens). */
export const NEWEST_TRUNCATE_FLOOR_TOKENS = 500;

export const TRUNCATION_SUFFIX = '\n… [truncated to fit context]';

export type PromptMeasure = (messages: readonly AgentMessage[]) => number;

export interface PruneMessagesOptions {
  maxHogTokens?: number;
  hogFraction?: number;
}

function messageTokens(message: AgentMessage, measure: PromptMeasure): number {
  return measure([message]);
}

function isResultBlob(message: AgentMessage): boolean {
  return (
    message.role === 'user' &&
    typeof message.content === 'string' &&
    message.content.startsWith(TOOL_RESULTS_PREFIX)
  );
}

/** Bodies safe to shrink: native tool results and XML result blobs. */
function isTruncatable(message: AgentMessage): boolean {
  return message.role === 'tool' || isResultBlob(message);
}

function withTruncatedBody(
  message: AgentMessage,
  budget: number,
  measure: PromptMeasure,
): AgentMessage {
  if (typeof message.content !== 'string') return message;
  if (messageTokens(message, measure) <= budget) return message;
  let lo = 0;
  let hi = message.content.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate: AgentMessage = {
      ...message,
      content: message.content.slice(0, mid) + TRUNCATION_SUFFIX,
    };
    if (messageTokens(candidate, measure) <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { ...message, content: message.content.slice(0, lo) + TRUNCATION_SUFFIX };
}

/**
 * Group the middle (everything between the pinned system message and the
 * pinned trailing message) into atomic units: an `assistant` message plus its
 * following `tool` replies (native) or result blob (XML). Lone messages form
 * singleton groups. Whole groups are dropped oldest-first so a surviving
 * `assistant(tool_calls)` never loses its `tool` replies.
 */
function groupMiddle(messages: AgentMessage[], last: number): AgentMessage[][] {
  const groups: AgentMessage[][] = [];
  let i = 1;
  while (i < last) {
    const message = messages[i];
    if (message.role === 'assistant') {
      const group = [message];
      i += 1;
      while (i < last && (messages[i].role === 'tool' || isResultBlob(messages[i]))) {
        group.push(messages[i]);
        i += 1;
      }
      groups.push(group);
    } else {
      groups.push([message]);
      i += 1;
    }
  }
  return groups;
}

/**
 * Shrink a prompt to `budget` tokens in three phases: (1) dynamic hog-guard
 * caps each older tool-result body at `min(maxHogTokens, budget*hogFraction)`;
 * (2) oldest exchange groups are dropped while over budget; (3) if the pinned
 * minimum itself is over budget, the newest exchange's tool bodies (with the
 * trailing tool result or result blob mid-run) are trimmed just enough to
 * fit. Pinned throughout: the system message, the
 * latest user request (never a result blob; earlier runs' requests come
 * before it), the trailing message, and at least the newest exchange group.
 * Messages keep their order.
 * Pure: never mutates the input; returns it untouched when under budget.
 */
export function pruneMessagesToBudget(
  messages: AgentMessage[],
  budget: number,
  measure: PromptMeasure,
  options: PruneMessagesOptions = {},
): AgentMessage[] {
  if (messages.length < 2 || budget <= 0) return messages;
  if (measure(messages) <= budget) return messages;

  const { maxHogTokens = DEFAULT_MAX_HOG_TOKENS, hogFraction = DEFAULT_HOG_FRACTION } = options;
  const hogCap = Math.min(maxHogTokens, Math.floor(budget * hogFraction));

  const pinnedFirst = messages[0];
  const pinnedLast = messages[messages.length - 1];
  let pinnedRequest: AgentMessage | null = null;
  for (let i = messages.length - 2; i >= 1; i -= 1) {
    if (messages[i].role === 'user' && !isResultBlob(messages[i])) {
      pinnedRequest = messages[i];
      break;
    }
  }
  let groups = groupMiddle(messages, messages.length - 1);

  const capHogs = (list: AgentMessage[][], cap: number, skipNewest: boolean): AgentMessage[][] => {
    const newest = list[list.length - 1];
    return list.map((group) => {
      if (skipNewest && group === newest) return group;
      let changed = false;
      const next = group.map((message) => {
        if (!isTruncatable(message) || messageTokens(message, measure) <= cap) return message;
        changed = true;
        return withTruncatedBody(message, cap, measure);
      });
      return changed ? next : group;
    });
  };

  const assemble = (list: AgentMessage[][]): AgentMessage[] => [pinnedFirst, ...list.flat(), pinnedLast];

  groups = capHogs(groups, hogCap, true);
  while (measure(assemble(groups)) > budget) {
    const oldest = groups.findIndex(
      (group, index) => index < groups.length - 1 && group[0] !== pinnedRequest,
    );
    if (oldest === -1) break;
    groups = groups.filter((_, index) => index !== oldest);
  }

  const pruned = assemble(groups);
  if (measure(pruned) <= budget) return pruned;

  let overage = measure(pruned) - budget;
  const trimToFit = (message: AgentMessage): AgentMessage => {
    if (overage <= 0 || !isTruncatable(message)) return message;
    const tokens = messageTokens(message, measure);
    if (tokens <= NEWEST_TRUNCATE_FLOOR_TOKENS) return message;
    const target = Math.max(NEWEST_TRUNCATE_FLOOR_TOKENS, tokens - overage);
    const next = withTruncatedBody(message, target, measure);
    overage -= tokens - messageTokens(next, measure);
    return next;
  };
  return [
    pinnedFirst,
    ...groups.slice(0, -1).flat(),
    ...(groups.at(-1) ?? []).map(trimToFit),
    trimToFit(pinnedLast),
  ];
}

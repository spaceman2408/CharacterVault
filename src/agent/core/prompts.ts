import { DEFAULT_MAX_ACTIONS_PER_TURN } from './runLoop';

export const NATIVE_TOOL_INTRO =
  'Call tools with the provided functions. Do not write tool XML or JSON in the message body.';

export const HISTORY_NOTES_GUIDE =
  'Earlier replies and tool results may include [App note: …] lines. The app adds them to list what that run changed, what the user kept after review, and why a run stopped. Never write them yourself.';

export const MENTIONS_GUIDE =
  'In user messages, @Name points at the field, greeting, or entry with that name, e.g. @Description, @Greeting 2, or @“Harbor” (#4) for entry #4.';

export const AGENT_TOOL_GUIDE = `${NATIVE_TOOL_INTRO}

You may emit up to ${DEFAULT_MAX_ACTIONS_PER_TURN} actions per reply, then wait for tool results. Finish each call with complete JSON arguments before starting the next.

${HISTORY_NOTES_GUIDE}

${MENTIONS_GUIDE}`;

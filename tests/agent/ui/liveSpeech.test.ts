import { describe, expect, it } from 'vitest';
import { LIVE_SPEECH_MAX_CHARS, liveAgentSpeech } from '../../../src/agent/ui/speechDraft';

describe('liveAgentSpeech', () => {
  it('returns plain speech unchanged', () => {
    expect(liveAgentSpeech("You're welcome!")).toBe("You're welcome!");
  });

  it('strips XML tool calls so only speech is shown live', () => {
    expect(
      liveAgentSpeech(`I'll add it.
<tool_call>
add_entry
name: Harbor
---
A busy harbor.
</tool_call>`),
    ).toBe("I'll add it.");
  });

  it('hides a tool-only payload', () => {
    expect(
      liveAgentSpeech(`<tool_call>
list_entries
</tool_call>`),
    ).toBe('');
  });

  it('keeps the tail of a long reply so the live DOM stays bounded', () => {
    const text = 'a'.repeat(LIVE_SPEECH_MAX_CHARS + 50);
    const clipped = liveAgentSpeech(text);
    expect(clipped.startsWith('…')).toBe(true);
    expect(clipped.length).toBe(LIVE_SPEECH_MAX_CHARS + 1);
    expect(clipped.endsWith('a'.repeat(20))).toBe(true);
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatModeSwitch } from '../../../src/components/ai/ChatModeSwitch';

afterEach(cleanup);

describe('ChatModeSwitch', () => {
  it('marks the current mode and switches to the other one', () => {
    const onChange = vi.fn();
    render(<ChatModeSwitch mode="agent" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Agent' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Orion' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Agent' }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Orion' }));
    expect(onChange).toHaveBeenCalledWith('orion');
  });
});

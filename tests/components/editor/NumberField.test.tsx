// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberField } from '../../../src/components/editor/lorebook/NumberField';

afterEach(cleanup);

function setup(initial: number, props: { fallback: number; min?: number; max?: number }) {
  const commits = vi.fn();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <NumberField
        {...props}
        value={value}
        ariaLabel="field"
        onCommit={(next) => {
          commits(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Harness />);
  const input = screen.getByLabelText('field') as HTMLInputElement;
  fireEvent.focus(input);
  return { input, commits };
}

const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, { target: { value } });

describe('NumberField', () => {
  it('lets a cleared probability be retyped', () => {
    const { input, commits } = setup(100, { fallback: 100, min: 0, max: 100 });
    type(input, '');
    expect(input.value).toBe('');
    type(input, '5');
    type(input, '50');
    fireEvent.blur(input);
    expect(commits.mock.calls.map(([n]) => n)).toEqual([5, 50]);
    expect(input.value).toBe('50');
  });

  it('accepts a negative insertion order', () => {
    const { input, commits } = setup(0, { fallback: 0 });
    type(input, '');
    type(input, '-5');
    fireEvent.blur(input);
    expect(commits.mock.calls.map(([n]) => n)).toEqual([-5]);
  });

  it('clamps out-of-range text on blur instead of while typing', () => {
    const { input, commits } = setup(40, { fallback: 100, min: 0, max: 100 });
    type(input, '150');
    expect(commits).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(commits.mock.calls.map(([n]) => n)).toEqual([100]);
    expect(input.value).toBe('100');
  });

  it('uses the fallback when left empty', () => {
    const { input, commits } = setup(40, { fallback: 100, min: 0, max: 100 });
    type(input, '');
    fireEvent.blur(input);
    expect(commits.mock.calls.map(([n]) => n)).toEqual([100]);
  });
});

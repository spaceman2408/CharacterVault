import type {
  LorebookDepthRole,
  LorebookPosition,
  LorebookSelectiveLogic,
} from '../../../db/characterTypes';

export const SELECTIVE_LOGIC_OPTIONS: { value: LorebookSelectiveLogic; label: string }[] = [
  { value: 0, label: 'AND ANY' },
  { value: 1, label: 'NOT ALL' },
  { value: 2, label: 'NOT ANY' },
  { value: 3, label: 'AND ALL' },
];

export const DEPTH_ROLE_OPTIONS: { value: LorebookDepthRole; label: string }[] = [
  { value: 0, label: 'System' },
  { value: 1, label: 'User' },
  { value: 2, label: 'Assistant' },
];

export const POSITION_OPTIONS: { value: LorebookPosition; label: string }[] = [
  { value: 'before_char', label: 'Before Character' },
  { value: 'after_char', label: 'After Character' },
  { value: 'before_example', label: 'Before Example Messages' },
  { value: 'after_example', label: 'After Example Messages' },
  { value: 'at_depth', label: 'At Depth' },
];

export const FIELD_CLASS =
  'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-border-strong focus:ring-2 focus:ring-accent/20';

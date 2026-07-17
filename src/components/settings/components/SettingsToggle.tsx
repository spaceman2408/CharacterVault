/**
 * @fileoverview Shared toggle switch used across settings tabs.
 * @module components/settings/components/SettingsToggle
 */

import React from 'react';

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** When true, label and description stack (description under label). */
  stacked?: boolean;
  disabled?: boolean;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  stacked = false,
  disabled = false,
}) => {
  if (stacked) {
    return (
      <label className="flex items-start gap-3 text-sm text-fg-muted cursor-pointer group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="peer sr-only"
          />
          <div className="w-10 h-6 bg-hover rounded-full peer-checked:bg-accent transition-colors duration-200 peer-disabled:opacity-50" />
          <div className="absolute left-1 top-1 w-4 h-4 bg-surface rounded-full transition-transform duration-200 peer-checked:translate-x-4" />
        </div>
        <div className="flex-1">
          <span className="group-hover:text-fg transition-colors font-medium">
            {label}
          </span>
          {description != null && (
            <p className="text-xs text-fg-muted mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </label>
    );
  }

  return (
    <label className="flex items-center gap-3 text-sm text-fg-muted cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className="w-10 h-6 bg-hover rounded-full peer-checked:bg-accent transition-colors duration-200 peer-disabled:opacity-50" />
        <div className="absolute left-1 top-1 w-4 h-4 bg-surface rounded-full transition-transform duration-200 peer-checked:translate-x-4" />
      </div>
      <span className="group-hover:text-fg transition-colors">
        {label}
      </span>
    </label>
  );
};

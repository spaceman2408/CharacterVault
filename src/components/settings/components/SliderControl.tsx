/**
 * @fileoverview Range slider with value display for sampler settings.
 * @module components/settings/components/SliderControl
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface SliderControlProps {
  id: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  showWarning?: boolean;
  warningMessage?: string;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  id,
  label,
  icon,
  value,
  min,
  max,
  step,
  onChange,
  formatValue = (v) => v.toString(),
  showWarning = false,
  warningMessage = '',
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium text-fg-muted"
      >
        <span className="p-1.5 rounded-md bg-muted text-fg-muted">
          {icon}
        </span>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-hover rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percentage}%, var(--hover) ${percentage}%, var(--hover) 100%)`,
          }}
        />
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-xs text-fg-muted">{formatValue(min)}</span>
          <span
            className={`text-sm font-semibold ${
              showWarning
                ? 'text-warning'
                : 'text-fg-muted'
            }`}
          >
            {formatValue(value)}
          </span>
          <span className="text-xs text-fg-muted">{formatValue(max)}</span>
        </div>
        {showWarning && warningMessage && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{warningMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

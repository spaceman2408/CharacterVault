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
        className="flex items-center gap-2 text-sm font-medium text-vault-700 dark:text-vault-300"
      >
        <span className="p-1.5 rounded-md bg-vault-100 dark:bg-vault-800 text-vault-600 dark:text-vault-400">
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
          className="w-full h-2 bg-vault-200 dark:bg-vault-700 rounded-lg appearance-none cursor-pointer accent-vault-600 dark:accent-vault-400 focus:outline-none focus:ring-2 focus:ring-vault-500/50"
          style={{
            background: `linear-gradient(to right, var(--color-vault-600) 0%, var(--color-vault-600) ${percentage}%, var(--color-vault-200) ${percentage}%, var(--color-vault-200) 100%)`,
          }}
        />
        <div className="flex justify-between items-center mt-1.5">
          <span className="text-xs text-vault-500">{formatValue(min)}</span>
          <span
            className={`text-sm font-semibold ${
              showWarning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-vault-700 dark:text-vault-300'
            }`}
          >
            {formatValue(value)}
          </span>
          <span className="text-xs text-vault-500">{formatValue(max)}</span>
        </div>
        {showWarning && warningMessage && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{warningMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * @fileoverview Card chrome for settings sections.
 * @module components/settings/components/SettingsCard
 */

import React from 'react';

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
  /** Optional title row with icon */
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** Use gradient background (e.g. sampler presets) */
  variant?: 'default' | 'gradient';
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  children,
  className = '',
  title,
  icon,
  variant = 'default',
}) => {
  const base =
    variant === 'gradient'
      ? 'bg-linear-to-br from-vault-50 to-vault-100 dark:from-vault-800/50 dark:to-vault-800 rounded-xl p-4 border border-vault-200 dark:border-vault-700'
      : 'bg-white dark:bg-vault-800/50 rounded-xl p-4 sm:p-5 border border-vault-200 dark:border-vault-700 shadow-sm';

  return (
    <div className={`${base} ${className}`}>
      {title != null && (
        <h3 className="text-sm font-semibold text-vault-800 dark:text-vault-200 mb-4 flex items-center gap-2">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

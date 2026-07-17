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
  /** @deprecated Kept for call-site compatibility; both variants use flat surface chrome */
  variant?: 'default' | 'gradient';
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  children,
  className = '',
  title,
  icon,
}) => {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-sm ${className}`}
    >
      {title != null && (
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

/**
 * @fileoverview Toast notifications for the settings panel.
 * @module components/settings/components/ToastContainer
 */

import React from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import type { ToastNotification } from '../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-100 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-in slide-in-from-right ${
            toast.type === 'success'
              ? 'bg-success-soft border border-success/30 text-success'
              : toast.type === 'error'
                ? 'bg-danger-soft border border-danger/30 text-danger'
                : 'bg-warning-soft border border-warning/30 text-warning-soft-fg'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-2 p-1 hover:bg-hover rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

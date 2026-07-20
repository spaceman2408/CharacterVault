/**
 * @fileoverview Delete message control — two-step confirm (trash → check).
 * @module components/ai/components/DeleteMessageButton
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';

export interface DeleteMessageButtonProps {
  onDelete: () => void;
  disabled?: boolean;
  variant?: 'default' | 'onAccent';
}

const CONFIRM_TIMEOUT_MS = 4000;

export const DeleteMessageButton: React.FC<DeleteMessageButtonProps> = memo(
  ({ onDelete, disabled = false, variant = 'default' }) => {
    const [confirming, setConfirming] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearConfirmTimer = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, []);

    const cancelConfirm = useCallback(() => {
      clearConfirmTimer();
      setConfirming(false);
    }, [clearConfirmTimer]);

    const armConfirm = useCallback(() => {
      clearConfirmTimer();
      setConfirming(true);
      timeoutRef.current = setTimeout(() => {
        setConfirming(false);
        timeoutRef.current = null;
      }, CONFIRM_TIMEOUT_MS);
    }, [clearConfirmTimer]);

    useEffect(() => {
      return () => clearConfirmTimer();
    }, [clearConfirmTimer]);

    useEffect(() => {
      if (!confirming) return;
      const onPointerDown = (e: PointerEvent) => {
        if (buttonRef.current?.contains(e.target as Node)) return;
        cancelConfirm();
      };
      document.addEventListener('pointerdown', onPointerDown);
      return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [confirming, cancelConfirm]);

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      if (confirming) {
        clearConfirmTimer();
        setConfirming(false);
        onDelete();
        return;
      }
      armConfirm();
    };

    const showConfirm = confirming && !disabled;

    const idleColor =
      variant === 'onAccent'
        ? 'text-accent-fg/70 hover:text-accent-fg hover:bg-white/15'
        : 'text-fg-subtle hover:text-danger hover:bg-danger-soft';

    const confirmColor =
      variant === 'onAccent'
        ? 'text-accent-fg bg-white/20 opacity-100'
        : 'text-danger bg-danger-soft opacity-100';

    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`p-1.5 rounded-md transition-all focus:opacity-100 disabled:opacity-40 disabled:pointer-events-none ${
          showConfirm
            ? confirmColor
            : `opacity-100 md:opacity-0 md:group-hover:opacity-100 ${idleColor}`
        }`}
        title={
          showConfirm
            ? 'Click again to confirm delete'
            : 'Delete this and all messages after'
        }
        aria-label={
          showConfirm
            ? 'Confirm delete this and all messages after'
            : 'Delete this and all messages after'
        }
      >
        {showConfirm ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    );
  }
);

DeleteMessageButton.displayName = 'DeleteMessageButton';

export default DeleteMessageButton;

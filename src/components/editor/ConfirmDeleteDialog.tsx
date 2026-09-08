import React from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps): React.ReactElement | null {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export default ConfirmDeleteDialog;

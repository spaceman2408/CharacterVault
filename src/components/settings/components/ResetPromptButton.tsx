import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../../ui/ConfirmDialog';

export const EditedBadge: React.FC = () => (
  <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-accent-soft text-accent text-[11px] font-medium normal-case">
    edited
  </span>
);

export const ResetPromptButton: React.FC<{ label: string; onReset: () => void }> = ({ label, onReset }) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 -my-0.5 text-xs font-medium text-fg-muted hover:text-accent hover:bg-accent-soft rounded-md transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        Reset to default
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Reset ${label}?`}
        message="Your text for this prompt will be replaced with the default."
        confirmLabel="Reset"
        onConfirm={() => {
          setConfirming(false);
          onReset();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};

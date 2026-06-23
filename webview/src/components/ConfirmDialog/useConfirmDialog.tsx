import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from './index';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface UseConfirmDialogReturn {
  confirmDialog: ReactNode;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export function useConfirmDialog(): UseConfirmDialogReturn {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const confirmDialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirmDialog, confirm };
}
